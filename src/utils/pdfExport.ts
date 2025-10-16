import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { format } from 'date-fns';
import { QUADRANT_COLORS } from '../lib/supabase';

// Enhanced color palette for professional look
const COLORS = {
  primary: { r: 37, g: 99, b: 235 }, // blue-600
  secondary: { r: 16, g: 185, b: 129 }, // green-500
  gray: {
    50: { r: 249, g: 250, b: 251 },
    100: { r: 243, g: 244, b: 246 },
    200: { r: 229, g: 231, b: 235 },
    300: { r: 209, g: 213, b: 219 },
    500: { r: 107, g: 114, b: 128 },
    600: { r: 75, g: 85, b: 99 },
    700: { r: 55, g: 65, b: 81 },
    900: { r: 17, g: 24, b: 39 }
  }
};

// Helper function to convert hex to RGB
function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 100, g: 100, b: 100 }; // Default gray if parsing fails
}

// Add letterhead background to page
async function addLetterheadBackground(pdf: jsPDF, letterheadImg: HTMLImageElement, pageWidth: number, pageHeight: number) {
  pdf.addImage(letterheadDataUrl, 'PNG', 0, 0, pageWidth, pageHeight);
  return 38; // Return Y position where content should start (1.5 inches = 38mm)
}

// Add footer with page numbers and user info
function addFooter(pdf: jsPDF, pageWidth: number, pageHeight: number, margin: number, pageNum: number, userName: string, churchName: string) {
  const footerY = pageHeight - 15;

  // Footer line
  pdf.setDrawColor(COLORS.gray[300].r, COLORS.gray[300].g, COLORS.gray[300].b);
  pdf.setLineWidth(0.5);
  pdf.line(margin, footerY - 5, pageWidth - margin, footerY - 5);

  // Footer text - left justified
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(COLORS.gray[500].r, COLORS.gray[500].g, COLORS.gray[500].b);

  const currentDate = format(new Date(), 'MMMM d, yyyy');
  pdf.text(`Generated for ${userName} at ${churchName} on ${currentDate}`, margin, footerY);

  // Page number - right justified
  pdf.text(`Page ${pageNum}`, pageWidth - margin - 20, footerY, { align: 'right' });
}

// Create enhanced section header (more compact)
function addSectionHeader(pdf: jsPDF, title: string, yPosition: number, margin: number, contentWidth: number) {
  // Background bar
  pdf.setFillColor(COLORS.gray[50].r, COLORS.gray[50].g, COLORS.gray[50].b);
  pdf.rect(margin - 5, yPosition - 6, contentWidth + 10, 10, 'F');

  // Left accent bar
  pdf.setFillColor(COLORS.primary.r, COLORS.primary.g, COLORS.primary.b);
  pdf.rect(margin - 5, yPosition - 6, 3, 10, 'F');

  // Section title
  pdf.setFontSize(13);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(COLORS.gray[900].r, COLORS.gray[900].g, COLORS.gray[900].b);
  pdf.text(title, margin + 5, yPosition);

  return yPosition + 10;
}

// Create compact quadrant card
function addQuadrantCard(pdf: jsPDF, item: any, profileBreakdown: Record<string, Record<string, number>>, yPosition: number, margin: number, contentWidth: number) {
  const cardHeight = 16; // Slightly larger for better readability

  // Card background
  pdf.setFillColor(255, 255, 255);
  pdf.rect(margin, yPosition, contentWidth, cardHeight, 'F');

  // Card border
  pdf.setDrawColor(COLORS.gray[300].r, COLORS.gray[300].g, COLORS.gray[300].b);
  pdf.setLineWidth(0.3);
  pdf.rect(margin, yPosition, contentWidth, cardHeight);

  // Quadrant color accent
  const color = QUADRANT_COLORS[item.quadrant];
  const rgb = hexToRgb(color);
  pdf.setFillColor(rgb.r, rgb.g, rgb.b);
  pdf.rect(margin, yPosition, 4, cardHeight, 'F');

  // Content area
  const contentX = margin + 10;
  let currentY = yPosition + 6;

  // Quadrant name
  pdf.setFontSize(11);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(COLORS.gray[900].r, COLORS.gray[900].g, COLORS.gray[900].b);
  pdf.text(item.name, contentX, currentY);

  // Stats
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(COLORS.gray[700].r, COLORS.gray[700].g, COLORS.gray[700].b);
  pdf.text(`${item.value} people (${item.percentage.toFixed(1)}%)`, contentX + 60, currentY);

  currentY += 5;

  // Profile breakdown
  if (profileBreakdown[item.quadrant]) {
    pdf.setFontSize(10); // Increased from 8 to match people count font size
    pdf.setFont('helvetica', 'normal'); // Explicitly set to helvetica to match title
    pdf.setTextColor(COLORS.gray[500].r, COLORS.gray[500].g, COLORS.gray[500].b);
    const profiles = Object.entries(profileBreakdown[item.quadrant])
      .sort(([,a], [,b]) => b - a)
      .map(([profile, count]) => `${profile}: ${count}`)
      .join('  |  '); // Use pipe separator instead of bullet

    const profileLines = pdf.splitTextToSize(`${profiles}`, contentWidth - 15);
    pdf.text(profileLines, contentX, currentY);
  }

  return yPosition + cardHeight + 3.5; // Slightly tighter spacing to fit on one page
}

export const exportToPDF = async (
  chartData: any[],
  profileBreakdown: Record<string, Record<string, number>>,
  getFilterTitle: () => string,
  includeList: boolean = false,
  individualAssessments: any[] = [],
  userName: string = 'User',
  churchName: string = 'Church',
  customTitle: string = 'Team Profile Report'
) => {
  try {
    const totalValue = chartData.reduce((sum, item) => sum + item.value, 0);

    // Create PDF with pure vector graphics - no need for html2canvas!
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 20;
    const contentWidth = pageWidth - (margin * 2);
    let pageNumber = 1;

    // Load and add letterhead background
    const letterheadImg = new Image();
    letterheadImg.crossOrigin = 'anonymous';
    letterheadImg.src = '/pdf/pp1.png';

    await new Promise((resolve, reject) => {
      letterheadImg.onload = resolve;
      letterheadImg.onerror = reject;
    });

    // Convert image to canvas to get data URL
    const canvas = document.createElement('canvas');
    canvas.width = letterheadImg.width;
    canvas.height = letterheadImg.height;
    const ctx = canvas.getContext('2d');
    ctx?.drawImage(letterheadImg, 0, 0);
    const letterheadDataUrl = canvas.toDataURL('image/png');

    // Add letterhead as background (full page)
    pdf.addImage(letterheadDataUrl, 'PNG', 0, 0, pageWidth, pageHeight);

    // Start content below letterhead header (1.5 inches = 38mm)
    let yPosition = 38;

    // Main title with enhanced styling (more compact)
    pdf.setFontSize(20); // Reduced from 22
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(COLORS.gray[900].r, COLORS.gray[900].g, COLORS.gray[900].b);
    pdf.text(customTitle, margin, yPosition);
    yPosition += 8; // Reduced from 10

    // Subtitle with better formatting (more compact)
    pdf.setFontSize(10); // Reduced from 11
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(COLORS.gray[700].r, COLORS.gray[700].g, COLORS.gray[700].b);
    const subtitle = getFilterTitle();
    const subtitleLines = pdf.splitTextToSize(subtitle, contentWidth);
    pdf.text(subtitleLines, margin, yPosition);
    yPosition += (subtitleLines.length * 4) + 8; // Reduced spacing

    // Enhanced chart section with VECTOR GRAPHICS (larger chart)
    const chartSectionY = yPosition;

    // Chart background
    pdf.setFillColor(COLORS.gray[50].r, COLORS.gray[50].g, COLORS.gray[50].b);
    pdf.rect(margin - 5, yPosition - 8, contentWidth + 10, 95, 'F'); // Reduced height from 110 to 95

    // Chart border
    pdf.setDrawColor(COLORS.gray[300].r, COLORS.gray[300].g, COLORS.gray[300].b);
    pdf.setLineWidth(0.5);
    pdf.rect(margin - 5, yPosition - 8, contentWidth + 10, 95); // Reduced height from 110 to 95

    // Draw vector donut chart
    const centerX = margin + 50;
    const centerY = yPosition + 40; // Adjusted center
    const outerRadius = 35; // Slightly smaller
    const innerRadius = 21;

    // Draw donut segments with no gaps
    let startAngle = -90;
    chartData.forEach((item) => {
      const sweepAngle = (item.value / totalValue) * 360;
      const rgb = hexToRgb(QUADRANT_COLORS[item.quadrant]);

      pdf.setFillColor(rgb.r, rgb.g, rgb.b);
      pdf.setDrawColor(rgb.r, rgb.g, rgb.b); // Match draw color to fill color

      // Use more segments for smoother rendering (1 degree per segment)
      const segments = Math.ceil(Math.abs(sweepAngle));
      const angleStep = sweepAngle / segments;

      for (let i = 0; i < segments; i++) {
        // Add tiny overlap to eliminate gaps
        const angle1 = (startAngle + i * angleStep - 0.1) * Math.PI / 180;
        const angle2 = (startAngle + (i + 1) * angleStep + 0.1) * Math.PI / 180;

        const x1_outer = centerX + outerRadius * Math.cos(angle1);
        const y1_outer = centerY + outerRadius * Math.sin(angle1);
        const x2_outer = centerX + outerRadius * Math.cos(angle2);
        const y2_outer = centerY + outerRadius * Math.sin(angle2);

        const x1_inner = centerX + innerRadius * Math.cos(angle1);
        const y1_inner = centerY + innerRadius * Math.sin(angle1);
        const x2_inner = centerX + innerRadius * Math.cos(angle2);
        const y2_inner = centerY + innerRadius * Math.sin(angle2);

        // Draw quad with matching stroke to eliminate white lines
        pdf.setLineWidth(0.1);
        pdf.triangle(x1_outer, y1_outer, x2_outer, y2_outer, x1_inner, y1_inner, 'FD');
        pdf.triangle(x2_outer, y2_outer, x2_inner, y2_inner, x1_inner, y1_inner, 'FD');
      }

      startAngle += sweepAngle;
    });

    // Draw white center circle
    pdf.setFillColor(255, 255, 255);
    pdf.circle(centerX, centerY, innerRadius, 'F');

    // Center text (larger)
    pdf.setFontSize(26);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(COLORS.gray[900].r, COLORS.gray[900].g, COLORS.gray[900].b);
    pdf.text(totalValue.toString(), centerX, centerY - 1, { align: 'center' });

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(COLORS.gray[600].r, COLORS.gray[600].g, COLORS.gray[600].b);
    pdf.text('People', centerX, centerY + 5, { align: 'center' }); // Reduced from +6 to +5

    // Draw legend (more compact)
    const legendX = centerX + outerRadius + 16;
    let legendY = yPosition + 12; // Adjusted for smaller chart

    chartData.forEach((item) => {
      const rgb = hexToRgb(QUADRANT_COLORS[item.quadrant]);

      // Color box
      pdf.setFillColor(rgb.r, rgb.g, rgb.b);
      pdf.roundedRect(legendX, legendY - 3, 6, 6, 1, 1, 'F');

      // Label
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(COLORS.gray[900].r, COLORS.gray[900].g, COLORS.gray[900].b);
      pdf.text(item.name, legendX + 10, legendY);

      // Count and percentage
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(COLORS.gray[600].r, COLORS.gray[600].g, COLORS.gray[600].b);
      pdf.text(`${item.value} (${item.percentage.toFixed(1)}%)`, legendX + 10, legendY + 4);

      legendY += 11;
    });

    yPosition += 95; // Match chart height + small gap

    // Add some spacing before cards
    yPosition += 6;

    // Add quadrant cards directly (no section header)
    for (const item of chartData) {
      if (yPosition > pageHeight - 35) { // Reduced from 80 to allow more space for cards
        addFooter(pdf, pageWidth, pageHeight, margin, pageNumber, userName, churchName);
        pdf.addPage();
        pageNumber++;
        pdf.addImage(letterheadDataUrl, 'PNG', 0, 0, pageWidth, pageHeight);
        yPosition = 38; // Start content below letterhead
      }

      yPosition = addQuadrantCard(pdf, item, profileBreakdown, yPosition, margin, contentWidth);
    }
    
    // Individual list section (if requested)
    if (includeList && individualAssessments.length > 0) {
      yPosition += 25;
      
      if (yPosition > pageHeight - 80) {
        addFooter(pdf, pageWidth, pageHeight, margin, pageNumber, userName, churchName);
        pdf.addPage();
        pageNumber++;
        pdf.addImage(letterheadDataUrl, 'PNG', 0, 0, pageWidth, pageHeight);
        yPosition = 38;
      }
      
      yPosition = addSectionHeader(pdf, 'Individual Team Members', yPosition, margin, contentWidth);
      
      // Group by quadrant with enhanced presentation
      const groupedByQuadrant = individualAssessments.reduce((acc, person) => {
        if (!acc[person.quadrant]) {
          acc[person.quadrant] = [];
        }
        acc[person.quadrant].push(person);
        return acc;
      }, {} as Record<string, any[]>);
      
      Object.entries(groupedByQuadrant).forEach(([quadrant, people]) => {
        if (yPosition > pageHeight - 60) {
          addFooter(pdf, pageWidth, pageHeight, margin, pageNumber, userName, churchName);
          pdf.addPage();
          pageNumber++;
          pdf.addImage(letterheadDataUrl, 'PNG', 0, 0, pageWidth, pageHeight);
          yPosition = 40;
        }
        
        const quadrantName = quadrant.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
        const color = QUADRANT_COLORS[quadrant];
        const rgb = hexToRgb(color);
        
        // Quadrant header
        if (rgb) {
          pdf.setFillColor(rgb.r, rgb.g, rgb.b, 0.1);
          pdf.rect(margin, yPosition, contentWidth, 10, 'F');
          pdf.setFillColor(rgb.r, rgb.g, rgb.b);
          pdf.rect(margin, yPosition, 4, 10, 'F');
        }
        
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(COLORS.gray[900].r, COLORS.gray[900].g, COLORS.gray[900].b);
        pdf.text(`${quadrantName} (${people.length} members)`, margin + 8, yPosition + 7);
        yPosition += 15;
        
        // Individual entries with enhanced formatting
        people.forEach((person) => {
          if (yPosition > pageHeight - 25) {
            addFooter(pdf, pageWidth, pageHeight, margin, pageNumber, userName, churchName);
            pdf.addPage();
            pageNumber++;
            pdf.addImage(letterheadDataUrl, 'PNG', 0, 0, pageWidth, pageHeight);
            yPosition = 40;
          }
          
          // Person card
          pdf.setFillColor(255, 255, 255);
          pdf.rect(margin + 5, yPosition, contentWidth - 10, 12, 'F');
          pdf.setDrawColor(COLORS.gray[300].r, COLORS.gray[300].g, COLORS.gray[300].b);
          pdf.rect(margin + 5, yPosition, contentWidth - 10, 12);
          
          pdf.setFontSize(10);
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(COLORS.gray[900].r, COLORS.gray[900].g, COLORS.gray[900].b);
          pdf.text(person.name, margin + 10, yPosition + 5);
          
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(COLORS.gray[700].r, COLORS.gray[700].g, COLORS.gray[700].b);
          pdf.text(`${person.profile}`, margin + 10, yPosition + 9);
          
          if (person.teamName || person.leadershipName) {
            pdf.setFontSize(8);
            pdf.setTextColor(COLORS.gray[500].r, COLORS.gray[500].g, COLORS.gray[500].b);
            const details = [person.teamName, person.leadershipName].filter(Boolean).join(' • ');
            pdf.text(details, margin + 100, yPosition + 7);
          }
          
          yPosition += 15;
        });
        
        yPosition += 5;
      });
    }
    
    // Add footer to last page
    addFooter(pdf, pageWidth, pageHeight, margin, pageNumber, userName, churchName);
    
    // Generate enhanced filename
    const date = format(new Date(), 'yyyy-MM-dd');
    const filename = `team-quadrant-analysis${includeList ? '-detailed' : ''}-${date}.pdf`;
    
    pdf.save(filename);
    return true;
  } catch (error) {
    console.error('Error exporting PDF:', error);
    throw error;
  }
};