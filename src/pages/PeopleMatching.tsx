import React, { useState, useEffect } from 'react';
import {
  UserCheck,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  AlertTriangle,
  Loader2,
  Users,
  Calendar,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { getSession } from '../utils/auth';
import { Toast } from '../components/Toast';
import { loadNicknameDatabase } from '../utils/nicknames';

// Utility function to format phone numbers for display
const formatPhoneNumber = (phone: string): string => {
  if (!phone) return '';

  // Remove all non-digits
  const digits = phone.replace(/\D/g, '');

  // Format US phone numbers (10 or 11 digits)
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  } else if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }

  // For other formats, return as-is with basic formatting
  return phone;
};

// Utility functions for field comparison
const calculateSimilarity = (str1: string, str2: string): number => {
  if (!str1 || !str2) return 0;

  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) return 1;

  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
};

const levenshteinDistance = (str1: string, str2: string): number => {
  const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

  for (let i = 0; i <= str1.length; i++) {
    matrix[0][i] = i;
  }

  for (let j = 0; j <= str2.length; j++) {
    matrix[j][0] = j;
  }

  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const substitutionCost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + substitutionCost
      );
    }
  }

  return matrix[str2.length][str1.length];
};

const normalizeName = (name: string): string => {
  if (!name) return '';
  return name.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
};

const normalizePhone = (phone: string): string => {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');

  if (digits.length === 10) {
    return `+1${digits}`;
  } else if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }

  return digits.length > 0 ? `+${digits}` : '';
};

// Cache for the nickname database
let nicknameDbCache: Map<string, Set<string>> = new Map();

// Field comparison functions
const compareNames = (assessmentName: string, planningCenterName: string): 'perfect' | 'close' | 'no-match' => {
  if (!assessmentName || !planningCenterName) return 'no-match';

  const normalizedAssessment = normalizeName(assessmentName);
  const normalizedPC = normalizeName(planningCenterName);

  // Check exact match first
  if (normalizedAssessment === normalizedPC) return 'perfect';

  // Split names into parts
  const assessmentParts = normalizedAssessment.split(' ');
  const pcParts = normalizedPC.split(' ');

  // Check if last names match and first names are nicknames of each other
  if (assessmentParts.length >= 2 && pcParts.length >= 2) {
    const assessmentFirst = assessmentParts[0];
    const assessmentLast = assessmentParts[assessmentParts.length - 1];
    const pcFirst = pcParts[0];
    const pcLast = pcParts[pcParts.length - 1];

    // Last names should match closely
    const lastNameSimilarity = calculateSimilarity(assessmentLast, pcLast);

    if (lastNameSimilarity >= 0.9) {
      // Check if first names are nicknames of each other using the database
      const assessmentNicknames = nicknameDbCache.get(assessmentFirst.toLowerCase());
      const pcNicknames = nicknameDbCache.get(pcFirst.toLowerCase());

      if (assessmentNicknames && assessmentNicknames.has(pcFirst.toLowerCase())) {
        return 'close';
      }

      if (pcNicknames && pcNicknames.has(assessmentFirst.toLowerCase())) {
        return 'close';
      }

      // Check if first names match closely (increased threshold to avoid false positives)
      const firstNameSimilarity = calculateSimilarity(assessmentFirst, pcFirst);
      if (firstNameSimilarity >= 0.95) return 'perfect';
      if (firstNameSimilarity >= 0.85) return 'close';
    }
  }

  // Fall back to overall similarity (stricter thresholds)
  const similarity = calculateSimilarity(normalizedAssessment, normalizedPC);

  if (similarity >= 0.95) return 'perfect';
  if (similarity >= 0.85) return 'close';
  return 'no-match';
};

const compareEmails = (assessmentEmail: string, planningCenterEmails: string[]): 'perfect' | 'close' | 'no-match' => {
  if (!assessmentEmail || !planningCenterEmails || planningCenterEmails.length === 0) return 'no-match';

  const assessmentLower = assessmentEmail.toLowerCase();
  const [assessmentLocal, assessmentDomain] = assessmentLower.split('@');

  // Check for exact email match
  const hasExactMatch = planningCenterEmails.some(email =>
    email.toLowerCase() === assessmentLower
  );

  if (hasExactMatch) return 'perfect';

  // Check for very similar emails (typos in domain, etc.)
  for (const email of planningCenterEmails) {
    const emailLower = email.toLowerCase();
    const [pcLocal, pcDomain] = emailLower.split('@');

    // Same local part (before @)
    if (assessmentLocal === pcLocal) {
      // If domains are very similar (allowing for typos like .con vs .com)
      const domainSimilarity = calculateSimilarity(assessmentDomain || '', pcDomain || '');
      if (domainSimilarity >= 0.8) return 'close';

      // Same mail server (e.g., both @gmail)
      const assessmentMailServer = assessmentDomain?.split('.')[0];
      const pcMailServer = pcDomain?.split('.')[0];
      if (assessmentMailServer && pcMailServer && assessmentMailServer === pcMailServer) {
        return 'close';
      }
    }

    // Different local part but same domain
    if (assessmentDomain && pcDomain && assessmentDomain === pcDomain) {
      return 'close';
    }
  }

  return 'no-match';
};

const comparePhones = (assessmentPhone: string, planningCenterPhones: string[]): 'perfect' | 'close' | 'no-match' => {
  if (!assessmentPhone || !planningCenterPhones || planningCenterPhones.length === 0) return 'no-match';

  const normalizedAssessment = normalizePhone(assessmentPhone);

  // Check for exact phone match
  const hasExactMatch = planningCenterPhones.some(phone =>
    normalizePhone(phone) === normalizedAssessment
  );

  if (hasExactMatch) return 'perfect';

  // Check for last 7 digits match
  const assessmentLast7 = normalizedAssessment.replace(/\D/g, '').slice(-7);
  if (assessmentLast7.length === 7) {
    const hasLast7Match = planningCenterPhones.some(phone => {
      const phoneLast7 = normalizePhone(phone).replace(/\D/g, '').slice(-7);
      return phoneLast7 === assessmentLast7;
    });

    if (hasLast7Match) return 'close';
  }

  return 'no-match';
};

// Get background color class based on comparison result
const getFieldBackgroundClass = (comparisonResult: 'perfect' | 'close' | 'no-match'): string => {
  switch (comparisonResult) {
    case 'perfect':
      return 'bg-green-50 border-green-200';
    case 'close':
      return 'bg-yellow-50 border-yellow-200';
    case 'no-match':
      return 'bg-red-50 border-red-200';
    default:
      return 'bg-gray-50 border-gray-200';
  }
};

// Calculate AI recommendation based on field comparisons
const calculateRecommendation = (
  nameComparison: 'perfect' | 'close' | 'no-match',
  emailComparison: 'perfect' | 'close' | 'no-match',
  phoneComparison: 'perfect' | 'close' | 'no-match',
  hasEmail: boolean,
  hasPhone: boolean
): 'match' | 'review' | 'no-match' => {
  // Count perfect and close matches
  let perfectCount = 0;
  let closeCount = 0;
  let noMatchCount = 0;
  let totalFields = 1; // name is always present

  if (nameComparison === 'perfect') perfectCount++;
  else if (nameComparison === 'close') closeCount++;
  else noMatchCount++;

  if (hasEmail) {
    totalFields++;
    if (emailComparison === 'perfect') perfectCount++;
    else if (emailComparison === 'close') closeCount++;
    else noMatchCount++;
  }

  if (hasPhone) {
    totalFields++;
    if (phoneComparison === 'perfect') perfectCount++;
    else if (phoneComparison === 'close') closeCount++;
    else noMatchCount++;
  }

  // Strict decision logic:
  // Name must at least be "close" for any match recommendation
  if (nameComparison === 'no-match') {
    return 'no-match'; // If name doesn't match at all, this is not a match
  }

  // HIGH CONFIDENCE MATCH: All fields are perfect or close, AND at least one is perfect
  if (noMatchCount === 0 && perfectCount >= 1) {
    return 'match'; // All fields match well, at least one perfect
  }

  // HIGH CONFIDENCE MATCH: At least 2 perfect matches
  if (perfectCount >= 2) {
    return 'match'; // At least 2 perfect matches
  }

  // REVIEW: Name is perfect and at least one other field is close/perfect
  if (nameComparison === 'perfect' && (emailComparison !== 'no-match' || phoneComparison !== 'no-match')) {
    return 'review'; // Name is perfect and at least one other field is close
  }

  // REVIEW: Name is close and at least one other field is perfect
  if (nameComparison === 'close' && (emailComparison === 'perfect' || phoneComparison === 'perfect')) {
    return 'review'; // Name is close and another field is perfect
  }

  // REVIEW: Name is close and at least one other field is also close
  if (nameComparison === 'close' && (emailComparison === 'close' || phoneComparison === 'close')) {
    return 'review'; // Name is close and another field is also close
  }

  // NO MATCH: Not enough evidence
  return 'no-match'; // Not enough evidence for a match
};

interface Assessment {
  id: number;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  planning_center_person_id?: string;
  // computed field
  name?: string;
}

interface PlanningCenterPerson {
  id: string;
  attributes: {
    first_name: string;
    last_name: string;
    name: string;
    status: string;
  };
}

interface Match {
  assessment: Assessment;
  match: {
    person: PlanningCenterPerson;
    emails: string[];
    phones: string[];
    score: number;
  } | null;
  confidence: 'highest_confidence' | 'high_confidence' | 'medium_confidence' | 'no_match_found';
  score: number;
  isPerfectMatch?: boolean;
}

const recommendationConfig = {
  match: {
    label: 'Match',
    color: 'bg-green-50 text-green-800 border-green-200',
    icon: CheckCircle,
    description: 'High confidence match'
  },
  review: {
    label: 'Review Carefully',
    color: 'bg-yellow-50 text-yellow-800 border-yellow-200',
    icon: AlertTriangle,
    description: 'Possible match - please review'
  },
  'no-match': {
    label: "Don't Match",
    color: 'bg-red-50 text-red-800 border-red-200',
    icon: XCircle,
    description: 'Unlikely to be the same person'
  }
};

export const PeopleMatching: React.FC = () => {
  const { churchId, isAdmin, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [loadingStage, setLoadingStage] = useState<string>('');
  const [processing, setProcessing] = useState(false);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [perfectMatches, setPerfectMatches] = useState<Match[]>([]);
  const [showPerfectMatchesSummary, setShowPerfectMatchesSummary] = useState(false);
  const [bulkApproving, setBulkApproving] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [planningCenterConnected, setPlanningCenterConnected] = useState<boolean | null>(null);
  const [pcoListId, setPcoListId] = useState<string | null>(null);
  const [needsListSetup, setNeedsListSetup] = useState(false);
  const [listIdInput, setListIdInput] = useState('');
  const [savingListId, setSavingListId] = useState(false);
  const [refreshingList, setRefreshingList] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('success');
  const [unmatchedCount, setUnmatchedCount] = useState<number>(0);
  const [showStartScreen, setShowStartScreen] = useState(false);

  useEffect(() => {
    // Load nickname database
    loadNicknameDatabase().then(db => {
      nicknameDbCache = db;
      console.log(`Loaded nickname database with ${db.size} entries`);
    }).catch(error => {
      console.error('Failed to load nickname database:', error);
    });
  }, []);

  useEffect(() => {
    if (!authLoading && churchId) {
      checkPlanningCenterConnection();
    }
  }, [authLoading, churchId]);

  const checkPlanningCenterConnection = async () => {
    try {
      setLoadingStage('Checking Planning Center connection...');

      const { data: churchData, error } = await supabase
        .from('churches')
        .select('planning_center_client_id, planning_center_connected_at, planning_center_access_token, pco_list_id')
        .eq('id', churchId)
        .single();

      console.log('Church data from database:', churchData);

      if (error) {
        console.error('Database error when fetching church data:', error);

        // If the error is about missing pco_list_id column, show a helpful message
        if (error.message?.includes('pco_list_id')) {
          setError('Database schema needs to be updated. Please push the migration file to apply the pco_list_id column.');
          setLoading(false);
          setLoadingStage('');
          return;
        }

        throw error;
      }

      const isConnected = churchData?.planning_center_client_id &&
                         churchData?.planning_center_connected_at &&
                         churchData?.planning_center_access_token;
      setPlanningCenterConnected(!!isConnected);
      setPcoListId(churchData?.pco_list_id || null);

      // Pre-populate the input field if we have a saved list ID
      if (churchData?.pco_list_id) {
        setListIdInput(churchData.pco_list_id);
      }

      if (isConnected) {
        if (churchData?.pco_list_id) {
          // Load unmatched count instead of auto-running matches
          await loadUnmatchedCount();
          setShowStartScreen(true);
          setLoading(false);
          setLoadingStage('');
        } else {
          setNeedsListSetup(true);
          setLoading(false);
          setLoadingStage('');
        }
      } else {
        setLoading(false);
        setLoadingStage('');
      }
    } catch (error) {
      console.error('Error checking Planning Center connection:', error);
      setError('Failed to check Planning Center connection');
      setLoading(false);
      setLoadingStage('');
    }
  };

  const loadUnmatchedCount = async () => {
    try {
      const { count, error } = await supabase
        .from('assessments')
        .select('id', { count: 'exact', head: true })
        .eq('church_id', churchId)
        .is('planning_center_person_id', null);

      if (error) throw error;

      setUnmatchedCount(count || 0);
    } catch (error) {
      console.error('Error loading unmatched count:', error);
      setUnmatchedCount(0);
    }
  };

  // Public function that uses current state
  const loadMatches = async (refreshList = false) => {
    if (!pcoListId) {
      console.log('No pcoListId in state, should show setup screen');
      setNeedsListSetup(true);
      setLoading(false);
      return;
    }
    return loadMatchesWithListId(pcoListId, refreshList);
  };

  // Helper function that accepts list ID as parameter to avoid state timing issues
  const loadMatchesWithListId = async (listId: string, refreshList = false) => {
    try {
      setLoading(true);
      setError(null);
      setShowStartScreen(false); // Hide start screen when loading matches

      if (!listId) {
        console.log('No listId provided, should show setup screen');
        setNeedsListSetup(true);
        setLoading(false);
        return;
      }

      const listIdToUse = listId;

      // First, get assessments without Planning Center person IDs
      setLoadingStage('Finding unmatched assessments...');

      const { data: assessments, error: assessmentError } = await supabase
        .from('assessments')
        .select('id, first_name, last_name, email, phone, planning_center_person_id')
        .eq('church_id', churchId)
        .is('planning_center_person_id', null);

      if (assessmentError) throw assessmentError;

      console.log('Assessments query result:', { assessments, count: assessments?.length });

      if (!assessments || assessments.length === 0) {
        console.log('No unmatched assessments found - showing "All people matched" message');
        setMatches([]);
        setLoading(false);
        setLoadingStage('');
        return;
      }

      // Add computed name field
      const assessmentsWithName = assessments.map(assessment => ({
        ...assessment,
        name: `${assessment.first_name || ''} ${assessment.last_name || ''}`.trim()
      }));

      setLoadingStage(`Downloading Planning Center people database...`);

      // Get the matching session for these assessments
      const session = getSession();
      if (!session || !session.user) {
        throw new Error('Authentication required');
      }

      const requestBody = {
        action: 'match-people',
        user_id: session.user.id,
        church_id: session.user.church_id,
        assessment_ids: assessmentsWithName.map(a => a.id),
        pco_list_id: listIdToUse,
        refresh_list: refreshList,
      };

      if (refreshList) {
        setLoadingStage('Refreshing Planning Center list and processing matches. Please do not refresh this page.');
      } else {
        setLoadingStage(`Searching for matches for ${assessmentsWithName.length} assessment${assessmentsWithName.length !== 1 ? 's' : ''} in Planning Center People`);
      }

      console.log('Invoking planning-center-people Edge Function with:', requestBody);
      console.log('Using list ID:', listIdToUse);
      console.log('Assessment IDs being sent:', assessmentsWithName.map(a => a.id));

      console.log('About to invoke planning-center-people function...');

      const { data, error } = await supabase.functions.invoke('planning-center-people', {
        body: requestBody,
      });

      console.log('Raw Edge Function response:', { data, error });

      if (error) {
        console.error('Edge Function error details:', error);
        console.error('Error type:', typeof error);
        console.error('Error keys:', Object.keys(error));
        console.error('Full error object:', JSON.stringify(error, null, 2));

        // Handle timeout errors specifically
        if (error.message?.includes('timeout') || error.status === 408) {
          throw new Error('Processing timeout - the system will automatically use smaller batches. Please try again.');
        }

        throw new Error(error.message || 'Failed to process matches');
      }

      if (!data.success) {
        console.error('Edge Function returned unsuccessful response:', data);

        // Check if it's a Planning Center connection issue
        if (data.error?.includes('Planning Center not connected')) {
          // This means Planning Center isn't set up for this church
          setError('Planning Center integration not found. Please connect Planning Center in Settings first.');
          return;
        }

        // Check if it's a list setup issue
        if (data.error?.includes('Purpose Paradigm Matching')) {
          setError(`${data.error}\n\nTo set up the list:\n1. Go to Planning Center People\n2. Create a new list named "Purpose Paradigm Matching"\n3. Add all people you want to match against\n4. Come back and try again`);
          return;
        }

        throw new Error(data.message || data.error || 'Failed to process matches');
      }

      setLoadingStage('Finalizing results...');

      // Handle perfect matches and regular matches
      const perfectMatches = data.perfectMatches || [];
      const regularMatches = data.regularMatches || data.matches || [];

      setPerfectMatches(perfectMatches);
      setMatches(regularMatches);
      setCurrentIndex(0);

      // Show perfect matches summary if there are any
      if (perfectMatches.length > 0) {
        setShowPerfectMatchesSummary(true);
      }

      // Show processing results
      if (data.list_info) {
        console.log('Planning Center list info:', data.list_info);

        if (data.list_info.people_count === 0) {
          setError('Planning Center List is empty. Please add people to this list in Planning Center before matching.');
        }
      }

    } catch (error) {
      console.error('Error loading matches:', error);
      setError(error instanceof Error ? error.message : 'Failed to load matches');
    } finally {
      setLoading(false);
      setLoadingStage('');
    }
  };

  const bulkApprovePerfectMatches = async () => {
    try {
      setBulkApproving(true);
      setError(null);

      // Prepare bulk updates
      const updates = perfectMatches
        .filter(match => match.match) // Only matches with actual Planning Center people
        .map(match => ({
          id: match.assessment.id,
          planning_center_person_id: match.match!.person.id
        }));

      if (updates.length === 0) {
        setError('No perfect matches to approve');
        return;
      }

      // Execute bulk update
      for (const update of updates) {
        const { data, error } = await supabase
          .from('assessments')
          .update({
            planning_center_person_id: update.planning_center_person_id
          })
          .eq('id', update.id)
          .eq('church_id', churchId)
          .select();

        console.log('Bulk update result:', { data, error, updateId: update.id });

        if (error) throw error;

        if (!data || data.length === 0) {
          throw new Error(`Failed to update assessment ${update.id}. This may be a permissions issue.`);
        }
      }

      setSuccess(`Successfully approved ${updates.length} perfect match${updates.length !== 1 ? 'es' : ''}!`);
      setTimeout(() => setSuccess(null), 5000);

      // Clear perfect matches and show regular matches
      setPerfectMatches([]);
      setShowPerfectMatchesSummary(false);

    } catch (error) {
      console.error('Error bulk approving matches:', error);
      setError(error instanceof Error ? error.message : 'Failed to approve matches');
    } finally {
      setBulkApproving(false);
    }
  };

  const approveMatch = async (assessmentId: number, planningCenterPersonId: string) => {
    try {
      setApproving(true);
      setError(null);

      const { data, error, count } = await supabase
        .from('assessments')
        .update({
          planning_center_person_id: planningCenterPersonId
        })
        .eq('id', assessmentId)
        .eq('church_id', churchId)
        .select();

      console.log('Update result:', { data, error, count, assessmentId, planningCenterPersonId });

      if (error) throw error;

      if (!data || data.length === 0) {
        throw new Error('No assessment was updated. This may be a permissions issue.');
      }

      // Remove this match from the list
      const newMatches = matches.filter(match => match.assessment.id !== assessmentId);
      setMatches(newMatches);

      // Adjust current index if needed
      if (currentIndex >= newMatches.length && newMatches.length > 0) {
        setCurrentIndex(newMatches.length - 1);
      } else if (newMatches.length === 0) {
        setCurrentIndex(0);
      }

      // Show toast instead of banner
      setToastMessage('Match approved successfully!');
      setToastType('success');
      setShowToast(true);

    } catch (error) {
      console.error('Error approving match:', error);
      setError(error instanceof Error ? error.message : 'Failed to approve match');
    } finally {
      setApproving(false);
    }
  };


  const goToPrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const goToNext = () => {
    if (currentIndex < matches.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const saveListId = async () => {
    if (!listIdInput.trim()) {
      setError('Please enter a valid list ID');
      return;
    }

    try {
      setSavingListId(true);
      setError(null);

      const listId = listIdInput.trim();
      console.log('Saving list ID to database:', { churchId, listId });

      const { error } = await supabase
        .from('churches')
        .update({ pco_list_id: listId })
        .eq('id', churchId);

      if (error) {
        console.error('Error saving list ID:', error);
        throw error;
      }

      console.log('List ID saved successfully, updating state');
      setPcoListId(listId);
      setNeedsListSetup(false);
      setListIdInput('');

      // Now load matches with the new list ID
      loadMatches();

    } catch (error) {
      console.error('Error saving list ID:', error);
      setError(error instanceof Error ? error.message : 'Failed to save list ID');
    } finally {
      setSavingListId(false);
    }
  };

  const refreshAndMatch = async () => {
    setRefreshingList(true);
    try {
      await loadMatches(true);
      setSuccess('List refreshed and matches updated!');
    } catch (error) {
      console.error('Error refreshing and matching:', error);
      setError('Failed to refresh list and load matches');
    } finally {
      setRefreshingList(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="space-y-8">
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center shadow-lg">
          <div className="w-20 h-20 bg-gradient-to-br from-red-500 to-red-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
            <AlertTriangle className="h-8 w-8 text-red-600" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-4">Admin Access Required</h3>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Only church administrators can access the people matching feature.
          </p>
        </div>
      </div>
    );
  }

  // Show loading while checking Planning Center connection
  if (planningCenterConnected === null) {
    return (
      <div className="space-y-8">
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center shadow-lg">
          <div className="w-20 h-20 bg-gradient-to-br from-accent-500 to-accent-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
            <Loader2 className="h-8 w-8 animate-spin text-accent-600" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-4">
            Checking Planning Center Connection...
          </h3>
          <p className="text-gray-600">Please wait while we verify your integration status</p>
        </div>
      </div>
    );
  }

  if (planningCenterConnected === false) {
    return (
      <div className="space-y-8">
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center shadow-lg">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
            <Calendar className="h-8 w-8 text-blue-600" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-4">
            Planning Center Not Connected
          </h3>
          <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
            Connect your Planning Center account to match people with assessment results.
          </p>
          <a
            href="/settings"
            className="inline-flex items-center px-8 py-4 text-base font-bold text-white bg-gradient-to-r from-accent-500 to-accent-600 border border-transparent rounded-xl hover:from-accent-600 hover:to-accent-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
          >
            <Calendar className="h-5 w-5 mr-3" />
            Go to Settings to Connect
          </a>
        </div>
      </div>
    );
  }

  if (needsListSetup) {
    return (
      <div className="space-y-8">
        <div className="bg-white rounded-2xl border border-gray-200 p-10 shadow-lg">
          <div className="flex items-center space-x-6 mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-accent-500 to-accent-600 rounded-xl flex items-center justify-center shadow-lg">
              <UserCheck className="h-6 w-6 text-accent-600" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                Planning Center List Required
              </h3>
              <p className="text-lg text-gray-600">
                Please provide the list ID from Planning Center People containing the people you want to match.
              </p>
            </div>
          </div>

          <div className="space-y-8">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">
                Planning Center List ID
              </label>
              <input
                type="text"
                value={listIdInput}
                onChange={(e) => setListIdInput(e.target.value)}
                placeholder={pcoListId ? pcoListId : "Enter list ID (e.g., 12345)"}
                className="w-full px-4 py-4 text-lg border border-gray-300 rounded-xl focus:ring-2 focus:ring-accent-500 focus:border-accent-500 bg-gray-50 focus:bg-white transition-all duration-200 shadow-sm focus:shadow-md font-mono"
              />
              <p className="text-sm text-gray-500 mt-3 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <strong>How to find your list ID:</strong><br />
                Find the list ID in your Planning Center URL: 
                <code className="bg-white px-3 py-1 rounded border ml-2 font-mono text-sm">https://people.planningcenteronline.com/lists/XXXXX</code>
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-6 shadow-lg">
                <div className="flex items-start space-x-3">
                  <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-red-900 mb-1">Error</h4>
                    <p className="text-sm text-red-800">{error}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-center">
              <button
                onClick={saveListId}
                disabled={savingListId || !listIdInput.trim()}
                className="inline-flex items-center px-8 py-4 text-base font-bold text-white bg-gradient-to-r from-accent-500 to-accent-600 border border-transparent rounded-xl hover:from-accent-600 hover:to-accent-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                {savingListId ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-3 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <UserCheck className="h-5 w-5 mr-3" />
                    View Potential Matches
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show start screen with unmatched count
  if (showStartScreen && !loading) {
    return (
      <div className="space-y-8">
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center shadow-lg">
          <div className="w-20 h-20 bg-gradient-to-br from-accent-500 to-accent-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
            <UserCheck className="h-8 w-8 text-white" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-4">
            People Matching
          </h3>
          <p className="text-lg text-gray-600 mb-2 max-w-2xl mx-auto">
            You currently have
          </p>
          <p className="text-5xl font-bold text-accent-600 mb-2">
            {unmatchedCount}
          </p>
          <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
            {unmatchedCount === 1 ? 'assessment' : 'assessments'} that {unmatchedCount === 1 ? 'is' : 'are'} not matched with people in Planning Center
          </p>

          {unmatchedCount > 0 ? (
            <button
              onClick={() => loadMatches()}
              className="inline-flex items-center px-8 py-4 text-base font-bold text-white bg-gradient-to-r from-accent-500 to-accent-600 border border-transparent rounded-xl hover:from-accent-600 hover:to-accent-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              <UserCheck className="h-5 w-5 mr-3" />
              Start Matching Process
            </button>
          ) : (
            <div className="bg-green-50 border border-green-200 rounded-xl p-6 inline-block">
              <div className="flex items-center space-x-3">
                <CheckCircle className="h-6 w-6 text-green-600" />
                <p className="text-green-800 font-semibold">All assessments are already matched!</p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center shadow-lg">
          <div className="w-20 h-20 bg-gradient-to-br from-accent-500 to-accent-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
            <Loader2 className="h-8 w-8 animate-spin text-white" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-4">
            {loadingStage || 'Loading people matches...'}
          </h3>
          <p className="text-lg text-gray-600">
            Please do not refresh this page
          </p>
        </div>
      </div>
    );
  }

  // Show perfect matches summary if available
  if (showPerfectMatchesSummary && perfectMatches.length > 0) {
    return (
      <div className="space-y-8">
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center shadow-lg">
          <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-4">
            {perfectMatches.length} Perfect Match{perfectMatches.length !== 1 ? 'es' : ''} Found!
          </h3>
          <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
            These people have exact matches (name, email and phone number). Would you like to approve them all at once?
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-6">
            <button
              onClick={bulkApprovePerfectMatches}
              disabled={bulkApproving}
              className="inline-flex items-center px-8 py-4 text-base font-bold text-white bg-gradient-to-r from-green-500 to-green-600 border border-transparent rounded-xl hover:from-green-600 hover:to-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              {bulkApproving ? (
                <>
                  <Loader2 className="h-5 w-5 mr-3 animate-spin" />
                  Approving...
                </>
              ) : (
                <>
                  <Check className="h-5 w-5 mr-3" />
                  Approve All {perfectMatches.length}
                </>
              )}
            </button>

            <button
              onClick={() => {
                // Combine perfect matches with regular matches for manual review
                const allMatches = [...perfectMatches, ...matches];
                setMatches(allMatches);
                setShowPerfectMatchesSummary(false);
                setCurrentIndex(0);
              }}
              className="inline-flex items-center px-8 py-4 text-base font-semibold text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              <Users className="h-5 w-5 mr-3" />
              Review Manually
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (matches.length === 0 && perfectMatches.length === 0 && !showStartScreen) {
    return (
      <div className="space-y-8">
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center shadow-lg">
          <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
            <CheckCircle className="h-8 w-8 text-white" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-4">
            All People Matched!
          </h3>
          <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
            All assessment participants have been matched with Planning Center people, or there are no unmatched assessments.
          </p>
          <button
            onClick={async () => {
              await loadUnmatchedCount();
              setShowStartScreen(true);
            }}
            className="inline-flex items-center px-8 py-4 text-base font-bold text-white bg-gradient-to-r from-accent-500 to-accent-600 border border-transparent rounded-xl hover:from-accent-600 hover:to-accent-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
          >
            <UserCheck className="h-5 w-5 mr-3" />
            Check for New Matches
          </button>
        </div>
      </div>
    );
  }

  const currentMatch = matches[currentIndex];

  // Calculate field comparisons for dynamic recommendation
  const nameComparison = currentMatch.match ?
    compareNames(currentMatch.assessment.name || '', currentMatch.match.person.attributes.name || '') :
    'no-match' as const;

  const emailComparison = currentMatch.match && currentMatch.assessment.email ?
    compareEmails(currentMatch.assessment.email, currentMatch.match.emails) :
    'no-match' as const;

  const phoneComparison = currentMatch.match && currentMatch.assessment.phone ?
    comparePhones(currentMatch.assessment.phone, currentMatch.match.phones) :
    'no-match' as const;

  // Calculate AI recommendation
  const recommendation = currentMatch.match ?
    calculateRecommendation(
      nameComparison,
      emailComparison,
      phoneComparison,
      !!currentMatch.assessment.email,
      !!currentMatch.assessment.phone
    ) :
    'no-match' as const;

  const recommendationDetails = recommendationConfig[recommendation];
  const RecommendationIcon = recommendationDetails.icon;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Action Bar */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-lg hover:shadow-xl transition-all duration-300">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-3 sm:space-y-0 sm:space-x-4">
          <button
            onClick={refreshAndMatch}
            disabled={loading || refreshingList}
            className="inline-flex items-center px-6 py-3 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow-md"
          >
            {refreshingList ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Refreshing...
              </>
            ) : (
              <>
                <UserCheck className="h-4 w-4 mr-2" />
                Refresh List & Match
              </>
            )}
          </button>

          <div className="text-sm font-bold text-accent-700 bg-gradient-to-r from-accent-50 to-accent-100 px-4 py-3 rounded-xl border border-accent-200 shadow-sm">
            {currentIndex + 1} of {matches.length}
          </div>
        </div>
      </div>

      {/* Status Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 shadow-lg">
          <div className="flex items-start space-x-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-red-900 mb-1">Error</h4>
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 shadow-lg">
          <div className="flex items-start space-x-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-green-900 mb-1">Success</h4>
              <p className="text-sm text-green-800">{success}</p>
            </div>
          </div>
        </div>
      )}

      {/* AI Recommendation */}
      <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-lg hover:shadow-xl transition-all duration-300">
        <div className="flex items-center justify-center">
          <div className={`inline-flex items-center space-x-4 px-6 py-4 rounded-xl text-base font-bold border-2 shadow-lg ${recommendationDetails.color}`}>
            <div className="w-8 h-8 rounded-lg bg-white bg-opacity-50 flex items-center justify-center">
              <RecommendationIcon className="h-5 w-5" />
            </div>
            <span>AI Recommendation: {recommendationDetails.label}</span>
          </div>
        </div>
      </div>

      {/* Comparison Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Assessment Person Card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
          <div className="flex items-center space-x-4 mb-6">
            <div className="w-14 h-14 bg-gradient-to-br from-accent-500 to-accent-600 rounded-xl flex items-center justify-center shadow-lg">
              <Users className="h-7 w-7 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">Purpose Paradigm</h3>
              <p className="text-sm font-semibold text-accent-600 uppercase tracking-wide">Assessment Results</p>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Full Name</label>
              <p className={`text-lg font-bold text-gray-900 px-4 py-3 rounded-lg border ${getFieldBackgroundClass(nameComparison)}`}>
                {currentMatch.assessment.name || 'No name provided'}
              </p>
            </div>

            {currentMatch.assessment.email && (
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Email Address</label>
                <p className={`text-lg font-bold text-gray-900 px-4 py-3 rounded-lg border font-mono ${getFieldBackgroundClass(emailComparison)}`}>
                  {currentMatch.assessment.email}
                </p>
              </div>
            )}

            {currentMatch.assessment.phone && (
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Phone Number</label>
                <p className={`text-lg font-bold text-gray-900 px-4 py-3 rounded-lg border font-mono ${getFieldBackgroundClass(phoneComparison)}`}>
                  {formatPhoneNumber(currentMatch.assessment.phone)}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Planning Center Person Card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
          <div className="flex items-center space-x-4 mb-6">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
              <Calendar className="h-7 w-7 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">Planning Center</h3>
              <p className="text-sm font-semibold text-blue-600 uppercase tracking-wide">People Database</p>
            </div>
          </div>

          {currentMatch.match ? (
            <div className="space-y-6">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Full Name</label>
                <p className={`text-lg font-bold text-gray-900 px-4 py-3 rounded-lg border ${getFieldBackgroundClass(nameComparison)}`}>
                  {currentMatch.match.person.attributes.name}
                </p>
              </div>

              {currentMatch.match.emails.length > 0 && (
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Email Address</label>
                  <div className="space-y-2">
                    {currentMatch.match.emails.map((email, index) => (
                      <p key={index} className={`text-lg font-bold text-gray-900 px-4 py-3 rounded-lg border font-mono ${getFieldBackgroundClass(emailComparison)}`}>
                        {email}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {currentMatch.match.phones.length > 0 && (
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Phone Number</label>
                  <div className="space-y-2">
                    {currentMatch.match.phones.map((phone, index) => (
                      <p key={index} className={`text-lg font-bold text-gray-900 px-4 py-3 rounded-lg border font-mono ${getFieldBackgroundClass(phoneComparison)}`}>
                        {formatPhoneNumber(phone)}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                <XCircle className="h-8 w-8 text-gray-400" />
              </div>
              <h4 className="text-lg font-semibold text-gray-900 mb-2">No Match Found</h4>
              <p className="text-gray-600">No suitable match found in Planning Center</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation and Actions */}
      <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-lg hover:shadow-xl transition-all duration-300">
        <div className="flex flex-col sm:flex-row items-center justify-between space-y-4 sm:space-y-0">
          <button
            onClick={goToPrevious}
            disabled={currentIndex === 0}
            className="inline-flex items-center px-6 py-3 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow-md"
          >
            <ChevronLeft className="h-5 w-5 mr-2" />
            Previous
          </button>

          <div className="flex items-center space-x-4">
            {currentMatch.match && (
              <button
                onClick={() => approveMatch(currentMatch.assessment.id, currentMatch.match!.person.id)}
                disabled={approving}
                className="inline-flex items-center px-8 py-4 text-base font-bold text-white bg-gradient-to-r from-green-500 to-green-600 border border-transparent rounded-xl hover:from-green-600 hover:to-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                {approving ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-3 animate-spin" />
                    Approving...
                  </>
                ) : (
                  <>
                    <Check className="h-5 w-5 mr-3" />
                    Approve Match
                  </>
                )}
              </button>
            )}

          </div>

          <button
            onClick={goToNext}
            disabled={currentIndex === matches.length - 1}
            className="inline-flex items-center px-6 py-3 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow-md"
          >
            Next
            <ChevronRight className="h-5 w-5 ml-2" />
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      <Toast
        message={toastMessage}
        type={toastType}
        isVisible={showToast}
        onClose={() => setShowToast(false)}
        duration={3000}
      />
    </div>
  );
};