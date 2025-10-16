import jsPDF from 'jspdf';
import { QUADRANT_COLORS } from '../lib/supabase';

// Helper function to convert hex to RGB
export function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
}

interface ChartData {
  name: string;
  value: number;
  percentage: number;
  quadrant: keyof typeof QUADRANT_COLORS;
}

/**
 * Draw a professional donut chart using vector graphics
 * This produces crisp, scalable charts instead of pixelated images
 */
export function drawDonutChart(
  pdf: jsPDF,
  data: ChartData[],
  centerX: number,
  centerY: number,
  outerRadius: number,
  innerRadius: number
) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  if (total === 0) {
    // Draw empty state
    pdf.setFillColor(240, 240, 240);
    pdf.circle(centerX, centerY, outerRadius, 'F');
    pdf.setFillColor(255, 255, 255);
    pdf.circle(centerX, centerY, innerRadius, 'F');

    pdf.setFontSize(12);
    pdf.setTextColor(150, 150, 150);
    pdf.text('No Data', centerX, centerY, { align: 'center' });
    return;
  }

  let currentAngle = -90; // Start at top (12 o'clock position)

  // Draw each segment
  data.forEach((item) => {
    const sweepAngle = (item.value / total) * 360;
    const color = hexToRgb(QUADRANT_COLORS[item.quadrant]);

    // Set fill color
    pdf.setFillColor(color.r, color.g, color.b);

    // Draw the donut segment using arc approximation with bezier curves
    drawDonutSegment(
      pdf,
      centerX,
      centerY,
      innerRadius,
      outerRadius,
      currentAngle,
      currentAngle + sweepAngle
    );

    currentAngle += sweepAngle;
  });

  // Draw white circle in center for donut effect
  pdf.setFillColor(255, 255, 255);
  pdf.circle(centerX, centerY, innerRadius, 'F');

  // Add center text
  pdf.setFontSize(24);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(50, 50, 50);
  pdf.text(total.toString(), centerX, centerY - 3, { align: 'center' });

  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(120, 120, 120);
  pdf.text('Total People', centerX, centerY + 5, { align: 'center' });
}

/**
 * Draw a donut segment using path-based drawing for smooth curves
 */
function drawDonutSegment(
  pdf: jsPDF,
  cx: number,
  cy: number,
  innerRadius: number,
  outerRadius: number,
  startAngle: number,
  endAngle: number
) {
  // Convert angles to radians
  const startRad = (startAngle * Math.PI) / 180;
  const endRad = (endAngle * Math.PI) / 180;

  // Calculate key points
  const outerStart = {
    x: cx + outerRadius * Math.cos(startRad),
    y: cy + outerRadius * Math.sin(startRad)
  };
  const outerEnd = {
    x: cx + outerRadius * Math.cos(endRad),
    y: cy + outerRadius * Math.sin(endRad)
  };
  const innerStart = {
    x: cx + innerRadius * Math.cos(startRad),
    y: cy + innerRadius * Math.sin(startRad)
  };
  const innerEnd = {
    x: cx + innerRadius * Math.cos(endRad),
    y: cy + innerRadius * Math.sin(endRad)
  };

  // Use arc approximation for smooth curves
  const segments = Math.max(1, Math.ceil(Math.abs(endAngle - startAngle) / 15));
  const angleStep = (endAngle - startAngle) / segments;

  // Start path at outer start point
  const pathData: any[] = [];

  // Outer arc
  for (let i = 0; i <= segments; i++) {
    const angle = startAngle + (angleStep * i);
    const rad = (angle * Math.PI) / 180;
    const x = cx + outerRadius * Math.cos(rad);
    const y = cy + outerRadius * Math.sin(rad);

    if (i === 0) {
      pathData.push(['m', x, y]);
    } else {
      pathData.push(['l', x, y]);
    }
  }

  // Connect to inner arc
  pathData.push(['l', innerEnd.x, innerEnd.y]);

  // Inner arc (reverse direction)
  for (let i = segments; i >= 0; i--) {
    const angle = startAngle + (angleStep * i);
    const rad = (angle * Math.PI) / 180;
    const x = cx + innerRadius * Math.cos(rad);
    const y = cy + innerRadius * Math.sin(rad);
    pathData.push(['l', x, y]);
  }

  // Close path
  pathData.push(['l', outerStart.x, outerStart.y]);

  // Draw the path
  drawPath(pdf, pathData);
}

/**
 * Draw a filled path from path data
 */
function drawPath(pdf: jsPDF, pathData: any[]) {
  if (pathData.length === 0) return;

  // Build path using lines (jsPDF doesn't have native path support)
  // We'll draw filled polygons instead
  const points: number[] = [];

  pathData.forEach(([cmd, x, y]) => {
    if (cmd === 'm' || cmd === 'l') {
      points.push(x, y);
    }
  });

  if (points.length >= 6) { // Need at least 3 points (6 coordinates)
    // Draw filled polygon
    pdf.setLineWidth(0.1);
    const triangles = triangulatePath(points);
    triangles.forEach(triangle => {
      pdf.triangle(
        triangle[0], triangle[1],
        triangle[2], triangle[3],
        triangle[4], triangle[5],
        'F'
      );
    });
  }
}

/**
 * Simple triangulation for convex polygons
 * Splits the path into triangles for filling
 */
function triangulatePath(points: number[]): number[][] {
  const triangles: number[][] = [];
  const numPoints = points.length / 2;

  // Simple fan triangulation from first point
  for (let i = 1; i < numPoints - 1; i++) {
    triangles.push([
      points[0], points[1],           // First point
      points[i * 2], points[i * 2 + 1],     // Current point
      points[(i + 1) * 2], points[(i + 1) * 2 + 1]  // Next point
    ]);
  }

  return triangles;
}

/**
 * Draw a professional legend with color boxes and percentages
 */
export function drawLegend(
  pdf: jsPDF,
  data: ChartData[],
  startX: number,
  startY: number,
  itemHeight: number = 12
) {
  let currentY = startY;

  data.forEach((item, index) => {
    const color = hexToRgb(QUADRANT_COLORS[item.quadrant]);

    // Draw color box
    pdf.setFillColor(color.r, color.g, color.b);
    pdf.roundedRect(startX, currentY - 4, 8, 8, 2, 2, 'F');

    // Draw label
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(50, 50, 50);
    pdf.text(item.name, startX + 12, currentY);

    // Draw count and percentage
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(100, 100, 100);
    pdf.text(`${item.value} (${item.percentage.toFixed(1)}%)`, startX + 12, currentY + 5);

    currentY += itemHeight;
  });
}

/**
 * Draw a horizontal bar chart for profile breakdown
 */
export function drawProfileBarChart(
  pdf: jsPDF,
  profileData: Record<string, number>,
  quadrantColor: string,
  startX: number,
  startY: number,
  maxWidth: number,
  itemHeight: number = 8
) {
  const entries = Object.entries(profileData).sort(([, a], [, b]) => b - a);
  const maxValue = Math.max(...entries.map(([, count]) => count));

  let currentY = startY;
  const color = hexToRgb(quadrantColor);

  entries.forEach(([profile, count]) => {
    const barWidth = (count / maxValue) * maxWidth;

    // Draw bar background
    pdf.setFillColor(240, 240, 240);
    pdf.roundedRect(startX + 60, currentY - 5, maxWidth, 6, 1, 1, 'F');

    // Draw bar
    pdf.setFillColor(color.r, color.g, color.b);
    pdf.roundedRect(startX + 60, currentY - 5, barWidth, 6, 1, 1, 'F');

    // Draw label
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(70, 70, 70);
    pdf.text(profile, startX, currentY);

    // Draw count
    pdf.setTextColor(100, 100, 100);
    pdf.text(count.toString(), startX + 63 + maxWidth, currentY);

    currentY += itemHeight;
  });

  return currentY;
}

/**
 * Draw a professional pie chart (alternative to donut)
 */
export function drawPieChart(
  pdf: jsPDF,
  data: ChartData[],
  centerX: number,
  centerY: number,
  radius: number
) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  if (total === 0) {
    // Draw empty state
    pdf.setFillColor(240, 240, 240);
    pdf.circle(centerX, centerY, radius, 'F');

    pdf.setFontSize(12);
    pdf.setTextColor(150, 150, 150);
    pdf.text('No Data', centerX, centerY, { align: 'center' });
    return;
  }

  let currentAngle = -90;

  data.forEach((item) => {
    const sweepAngle = (item.value / total) * 360;
    const color = hexToRgb(QUADRANT_COLORS[item.quadrant]);

    pdf.setFillColor(color.r, color.g, color.b);

    // Draw pie segment
    drawPieSegment(pdf, centerX, centerY, radius, currentAngle, currentAngle + sweepAngle);

    currentAngle += sweepAngle;
  });
}

/**
 * Draw a pie segment
 */
function drawPieSegment(
  pdf: jsPDF,
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number
) {
  const startRad = (startAngle * Math.PI) / 180;
  const endRad = (endAngle * Math.PI) / 180;

  const segments = Math.max(1, Math.ceil(Math.abs(endAngle - startAngle) / 15));
  const angleStep = (endAngle - startAngle) / segments;

  const pathData: any[] = [];
  pathData.push(['m', cx, cy]); // Start at center

  // Draw arc
  for (let i = 0; i <= segments; i++) {
    const angle = startAngle + (angleStep * i);
    const rad = (angle * Math.PI) / 180;
    const x = cx + radius * Math.cos(rad);
    const y = cy + radius * Math.sin(rad);
    pathData.push(['l', x, y]);
  }

  // Back to center
  pathData.push(['l', cx, cy]);

  drawPath(pdf, pathData);
}
