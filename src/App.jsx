import { useState, useEffect, useMemo } from 'react';
import { CredentialsManager } from './CredentialsManager';
import { PluggyItemsManager } from './PluggyItemsManager';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  AreaChart, Area
} from 'recharts';
import { DateTime } from 'luxon';
import { clsx } from 'clsx';
import { api } from './api';

// Paleta de cores monocromática futurista
const COLORS = {
  primary: '#00D4FF',
  secondary: '#7B61FF', 
  success: '#00FF94',
  danger: '#FF4757',
  warning: '#FFB800',
  muted: '#64748b',
};

const CHART_COLORS = ['#00D4FF', '#7B61FF', '#00FF94', '#FFB800', '#FF4757', '#FF6B9D', '#00CED1', '#9B59B6'];

const getCurrentPeriod = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

function App() {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showPluggyItemsModal, setShowPluggyItemsModal] = useState(false);
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [newCategory, setNewCategory] = useState('');
  // Restaurar estado salvo ao carregar
  const getSavedState = () => {
    try {
      const savedTab = sessionStorage.getItem('activeTab');
      const savedFilters = sessionStorage.getItem('filters');
      // Manter a aba salva (sem migração automática)
      const tab = savedTab || 'overview';
      return {
        tab: tab,
        filters: savedFilters ? JSON.parse(savedFilters) : null
      };
    } catch (e) {
      return { tab: 'overview', filters: null };
    }
  };

  const savedState = getSavedState();
  const [activeTab, setActiveTab] = useState(savedState.tab);
  const [hideValues, setHideValues] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [logoError, setLogoError] = useState(false);
  const [logoSrc, setLogoSrc] = useState(null);
  const [processedLogoSrc, setProcessedLogoSrc] = useState(null);

  // Função para remover fundo branco da imagem
  const removeWhiteBackground = (imageSrc, callback) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;
        
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        // Tornar pixels brancos (ou quase brancos) transparentes
        // Threshold muito mais agressivo para remover TODO o fundo branco
        const threshold = 200; // Pixels com R, G, B > 200 serão removidos
        const minBrightness = 220; // Brilho mínimo para considerar como branco
        
        let whitePixelsRemoved = 0;
        let totalPixels = 0;
        
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const alpha = data[i + 3];
          
          totalPixels++;
          
          // Calcular brilho médio
          const brightness = (r + g + b) / 3;
          
          // Se o pixel é branco ou muito claro (múltiplas condições mais agressivas)
          const isWhite = (
            (r > threshold && g > threshold && b > threshold) || // Todos os canais acima do threshold
            brightness > minBrightness || // Brilho médio muito alto
            (r > 240 && g > 240 && b > 240) || // Branco quase puro
            (Math.abs(r - g) < 10 && Math.abs(g - b) < 10 && brightness > 200) // Tons de cinza claros
          );
          
          if (isWhite && alpha > 0) {
            data[i + 3] = 0; // alpha = 0 (transparente)
            whitePixelsRemoved++;
          }
        }
        
        console.log(`Logo processado: ${whitePixelsRemoved} pixels brancos removidos de ${totalPixels} pixels`);
        
        ctx.putImageData(imageData, 0, 0);
        callback(canvas.toDataURL('image/png'));
      } catch (error) {
        console.warn('Erro ao processar logo:', error);
        callback(imageSrc); // Fallback para imagem original
      }
    };
    img.onerror = () => callback(imageSrc); // Fallback para imagem original
    img.src = imageSrc;
  };

  // Tentar carregar o logo em diferentes formatos e nomes
  useEffect(() => {
    const possibleNames = ['flux', 'logo'];
    const formats = ['png', 'jpg', 'jpeg', 'svg', 'webp'];
    let currentName = 0;
    let currentFormat = 0;
    
    const tryLoadLogo = () => {
      if (currentName >= possibleNames.length) {
        setLogoError(true);
        return;
      }
      
      if (currentFormat >= formats.length) {
        currentName++;
        currentFormat = 0;
        tryLoadLogo();
        return;
      }
      
      const img = new Image();
      const src = `/assets/${possibleNames[currentName]}.${formats[currentFormat]}`;
      img.onload = () => {
        setLogoSrc(src);
        // Processar imagem para remover fundo branco
        removeWhiteBackground(src, (processedSrc) => {
          setProcessedLogoSrc(processedSrc);
        });
      };
      img.onerror = () => {
        currentFormat++;
        tryLoadLogo();
      };
      img.src = src;
    };
    
    tryLoadLogo();
  }, []);
  
  const [realBalances, setRealBalances] = useState({
    bankBalance: 0,
    creditCardBalance: 0,
    creditCardBillsDetailed: [],
    accounts: [],
    loading: false,
  });
  
  const [loansData, setLoansData] = useState({
    loans: [],
    summary: null,
    loading: false,
    error: null,
  });

  const [showLoanModal, setShowLoanModal] = useState(false);
  const [editingLoan, setEditingLoan] = useState(null);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [selectedLoanForTransaction, setSelectedLoanForTransaction] = useState(null);
  const [transactionForm, setTransactionForm] = useState({
    date: '',
    amount: '',
    description: '',
    installmentNumber: ''
  });

  const [goalsData, setGoalsData] = useState({
    goals: [],
    loading: false,
    error: null,
  });
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);
  const [goalForm, setGoalForm] = useState({
    name: '', // Nome é a categoria
    targetAmount: '',
    periodMonth: new Date().getMonth() + 1,
    periodYear: new Date().getFullYear()
  });

  // Financial Goals (Novas Metas)
  const [financialGoalsData, setFinancialGoalsData] = useState({
    goals: [],
    loading: false,
    error: null,
  });
  const [showFinancialGoalModal, setShowFinancialGoalModal] = useState(false);
  const [editingFinancialGoal, setEditingFinancialGoal] = useState(null);
  const [financialGoalForm, setFinancialGoalForm] = useState({
    name: '',
    type: 'custom',
    targetAmount: '',
    currentAmount: '',
    description: '',
    targetDate: '',
    tag: '',
  });

  // Due Dates (Calendário)
  const [dueDatesData, setDueDatesData] = useState({
    calendar: {},
    all: [],
    loading: false,
    error: null,
  });
  const [showDueDateModal, setShowDueDateModal] = useState(false);
  const [editingDueDate, setEditingDueDate] = useState(null);
  const [dueDateForm, setDueDateForm] = useState({
    name: '',
    type: 'custom',
    amount: '',
    due_day: '',
  });


  const [expandedBalance, setExpandedBalance] = useState(false);
  const [loanForm, setLoanForm] = useState({
    description: '',
    type: 'Outro',
    bankName: '',
    ownerName: '',
    totalAmount: '',
    totalInstallments: '',
    paidInstallments: '',
    installmentValue: '',
    interestRate: '',
    dueDate: '',
    paymentMethod: ''
  });
  
  const [filters, setFilters] = useState(savedState.filters || {
    period: getCurrentPeriod(),
    accountType: 'all',
    bankName: 'all',
    ownerName: 'all',
    category: 'all',
  });

  // Salvar estado (aba, filtros e scroll) sempre que mudarem
  useEffect(() => {
    sessionStorage.setItem('activeTab', activeTab);
    sessionStorage.setItem('filters', JSON.stringify(filters));
  }, [activeTab, filters]);

  // Salvar posição do scroll continuamente
  useEffect(() => {
    let scrollTimeout;
    const handleScroll = () => {
      // Debounce para não salvar a cada pixel
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        sessionStorage.setItem('scrollPosition', window.scrollY.toString());
      }, 100);
    };
    
    // Salvar scroll a cada mudança
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    // Também salvar antes de sair
    const handleBeforeUnload = () => {
      sessionStorage.setItem('scrollPosition', window.scrollY.toString());
      sessionStorage.setItem('activeTab', activeTab);
      sessionStorage.setItem('filters', JSON.stringify(filters));
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      clearTimeout(scrollTimeout);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [activeTab, filters]);

  // Restaurar posição do scroll após carregar - usar um único useEffect que monitora tudo
  useEffect(() => {
    if (loading || !dashboardData) return;
    
    const savedScrollPosition = sessionStorage.getItem('scrollPosition');
    const savedActiveTab = sessionStorage.getItem('activeTab');
    
    if (!savedActiveTab || savedActiveTab !== activeTab || !savedScrollPosition) {
      return;
    }
    
    const scrollPos = parseInt(savedScrollPosition, 10);
    if (scrollPos <= 0) return;
    
    // Usar MutationObserver para detectar quando o DOM está estável
    const observer = new MutationObserver(() => {
      // Verificar se o conteúdo tem altura suficiente
      if (document.documentElement.scrollHeight >= scrollPos) {
        // Restaurar scroll
        window.scrollTo(0, scrollPos);
        observer.disconnect();
      }
    });
    
    // Observar mudanças no body
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    // Também tentar imediatamente e após delays
    const restoreScroll = () => {
      if (document.documentElement.scrollHeight >= scrollPos) {
        window.scrollTo(0, scrollPos);
        observer.disconnect();
        return true;
      }
      return false;
    };
    
    // Tentar imediatamente
    if (!restoreScroll()) {
      // Tentar após pequenos delays
      setTimeout(() => {
        if (!restoreScroll()) {
          setTimeout(() => {
            restoreScroll();
            observer.disconnect();
          }, 500);
        }
      }, 200);
    }
    
    // Limpar observer após 2 segundos
    setTimeout(() => {
      observer.disconnect();
    }, 2000);
    
    return () => {
      observer.disconnect();
    };
  }, [loading, dashboardData, activeTab]);

  useEffect(() => {
    loadDashboard();
    loadRealBalances(filters.period);
  }, [filters]);

  const loadRealBalances = async (period = null) => {
    try {
      setRealBalances(prev => ({ ...prev, loading: true }));
      const balances = await api.getRealBalances(period);
      setRealBalances({
        bankBalance: balances.bankBalance || 0,
        creditCardBalance: balances.creditCardBalance || 0,
        creditCardBillsDetailed: balances.creditCardBillsDetailed || [],
        accounts: balances.accounts || [],
        loading: false,
      });
    } catch (err) {
      console.error('Erro ao buscar saldos reais:', err);
      setRealBalances(prev => ({ ...prev, loading: false }));
    }
  };

  const loadLoans = async () => {
    try {
      setLoansData(prev => ({ ...prev, loading: true, error: null }));
      const data = await api.getLoans();
      setLoansData({
        loans: data.loans || [],
        summary: data.summary || null,
        loading: false,
        error: null,
      });
    } catch (err) {
      console.error('Erro ao buscar empréstimos:', err);
      setLoansData(prev => ({ ...prev, loading: false, error: err.message }));
    }
  };

  const handleOpenLoanModal = (loan = null) => {
    if (loan) {
      setEditingLoan(loan);
      setLoanForm({
        description: loan.description,
        type: loan.type,
        bankName: loan.bankName !== 'Não informado' ? loan.bankName : '',
        ownerName: loan.ownerName !== 'Não informado' ? loan.ownerName : '',
        totalAmount: loan.totalAmount.toString(),
        totalInstallments: loan.totalInstallments.toString(),
        paidInstallments: loan.paidInstallments.toString(),
        installmentValue: loan.totalInstallments > 0 ? (loan.totalAmount / loan.totalInstallments).toFixed(2) : '',
        interestRate: loan.interestRate ? loan.interestRate.toString() : '',
        dueDate: loan.dueDate || '',
        paymentMethod: loan.paymentMethod || ''
      });
    } else {
      setEditingLoan(null);
      setLoanForm({
        description: '',
        type: 'Outro',
        bankName: '',
        ownerName: '',
        totalAmount: '',
        totalInstallments: '',
        paidInstallments: '0',
        installmentValue: '',
        interestRate: '',
        dueDate: '',
        paymentMethod: ''
      });
    }
    setShowLoanModal(true);
  };

  const handleCloseLoanModal = () => {
    setShowLoanModal(false);
    setEditingLoan(null);
    setLoanForm({
      description: '',
      type: 'Outro',
      bankName: '',
      ownerName: '',
      totalAmount: '',
      totalInstallments: '',
      paidInstallments: '0',
      installmentValue: '',
      interestRate: '',
      dueDate: '',
      paymentMethod: ''
    });
  };

  const handleSaveLoan = async () => {
    try {
      const loanData = {
        description: loanForm.description,
        type: loanForm.type,
        bankName: loanForm.bankName || null,
        ownerName: loanForm.ownerName || null,
        totalAmount: parseFloat(loanForm.totalAmount),
        totalInstallments: parseInt(loanForm.totalInstallments),
        paidInstallments: parseInt(loanForm.paidInstallments) || 0,
        installmentValue: loanForm.installmentValue ? parseFloat(loanForm.installmentValue) : (parseFloat(loanForm.totalAmount) / parseInt(loanForm.totalInstallments)),
        interestRate: loanForm.interestRate ? parseFloat(loanForm.interestRate) : null,
        dueDate: loanForm.dueDate || null,
        paymentMethod: loanForm.paymentMethod || null,
        sourceLoanId: editingLoan && !editingLoan.isManual ? editingLoan.id : null
      };

      if (editingLoan) {
        await api.updateLoan(editingLoan.id, loanData);
      } else {
        await api.createLoan(loanData);
      }

      handleCloseLoanModal();
      await loadLoans();
    } catch (err) {
      console.error('Erro ao salvar empréstimo:', err);
      alert('Erro ao salvar empréstimo: ' + err.message);
    }
  };

  const handleDeleteLoan = async (loanId) => {
    if (!confirm('Tem certeza que deseja deletar este empréstimo?')) {
      return;
    }

    try {
      await api.deleteLoan(loanId);
      await loadLoans();
    } catch (err) {
      console.error('Erro ao deletar empréstimo:', err);
      alert('Erro ao deletar empréstimo: ' + err.message);
    }
  };

  const handleOpenTransactionModal = (loan) => {
    setSelectedLoanForTransaction(loan);
    setTransactionForm({
      date: new Date().toISOString().split('T')[0],
      amount: '',
      description: '',
      installmentNumber: (loan.paidInstallments + 1).toString()
    });
    setShowTransactionModal(true);
  };

  const handleCloseTransactionModal = () => {
    setShowTransactionModal(false);
    setSelectedLoanForTransaction(null);
    setTransactionForm({
      date: '',
      amount: '',
      description: '',
      installmentNumber: ''
    });
  };

  const handleSaveTransaction = async () => {
    try {
      if (!selectedLoanForTransaction) return;

      await api.addLoanTransaction(selectedLoanForTransaction.id, {
        date: transactionForm.date,
        amount: parseFloat(transactionForm.amount),
        description: transactionForm.description,
        installmentNumber: transactionForm.installmentNumber ? parseInt(transactionForm.installmentNumber) : null
      });

      handleCloseTransactionModal();
      await loadLoans();
    } catch (err) {
      console.error('Erro ao salvar transação:', err);
      alert('Erro ao salvar transação: ' + err.message);
    }
  };

  const handleDeleteTransaction = async (loanId, transactionId) => {
    if (!confirm('Tem certeza que deseja deletar esta transação?')) {
      return;
    }

    try {
      await api.deleteLoanTransaction(loanId, transactionId);
      await loadLoans();
    } catch (err) {
      console.error('Erro ao deletar transação:', err);
      alert('Erro ao deletar transação: ' + err.message);
    }
  };

  const loadGoals = async () => {
    try {
      setGoalsData(prev => ({ ...prev, loading: true, error: null }));
      // Usar o mesmo período do filtro atual
      const periodParam = filters.period && filters.period !== 'all' ? `?period=${filters.period}` : '';
      const data = await api.getGoals(periodParam);
      setGoalsData({
        goals: data.goals || [],
        loading: false,
        error: null,
      });
    } catch (err) {
      console.error('Erro ao buscar metas:', err);
      setGoalsData(prev => ({ ...prev, loading: false, error: err.message }));
    }
  };

  useEffect(() => {
    if (activeTab === 'limits') {
      loadGoals();
    }
    if (activeTab === 'goals') {
      loadFinancialGoals();
    }
    if (activeTab === 'calendar') {
      loadDueDates();
    }
  }, [activeTab, filters.period]);

  const handleOpenGoalModal = (goal = null) => {
    if (goal) {
      setEditingGoal(goal);
      setGoalForm({
        name: goal.name || goal.category || '',
        targetAmount: goal.targetAmount.toString(),
        periodMonth: goal.periodMonth || new Date().getMonth() + 1,
        periodYear: goal.periodYear || new Date().getFullYear()
      });
    } else {
      const now = new Date();
      setEditingGoal(null);
      setGoalForm({
        name: '',
        targetAmount: '',
        periodMonth: now.getMonth() + 1,
        periodYear: now.getFullYear()
      });
    }
    setShowGoalModal(true);
  };

  const handleCloseGoalModal = () => {
    const now = new Date();
    setShowGoalModal(false);
    setEditingGoal(null);
    setGoalForm({
      name: '',
      targetAmount: '',
      periodMonth: now.getMonth() + 1,
      periodYear: now.getFullYear()
    });
  };

  const handleSaveGoal = async () => {
    try {
      const goalData = {
        name: goalForm.name, // Nome é a categoria
        targetAmount: parseFloat(goalForm.targetAmount),
        periodMonth: parseInt(goalForm.periodMonth),
        periodYear: parseInt(goalForm.periodYear)
      };

      if (editingGoal) {
        await api.updateGoal(editingGoal.id, goalData);
      } else {
        await api.createGoal(goalData);
      }

      handleCloseGoalModal();
      await loadGoals();
    } catch (err) {
      console.error('Erro ao salvar meta:', err);
      alert('Erro ao salvar meta: ' + err.message);
    }
  };

  const handleDeleteGoal = async (goalId) => {
    if (!confirm('Tem certeza que deseja deletar este limite?')) {
      return;
    }

    try {
      await api.deleteGoal(goalId);
      await loadGoals();
    } catch (err) {
      console.error('Erro ao deletar limite:', err);
      alert('Erro ao deletar limite: ' + err.message);
    }
  };

  // Financial Goals Functions
  const loadFinancialGoals = async () => {
    try {
      setFinancialGoalsData(prev => ({ ...prev, loading: true, error: null }));
      const data = await api.getFinancialGoals();
      setFinancialGoalsData({
        goals: data.goals || [],
        loading: false,
        error: null,
      });
    } catch (err) {
      console.error('Erro ao buscar metas financeiras:', err);
      setFinancialGoalsData(prev => ({ ...prev, loading: false, error: err.message }));
    }
  };

  const handleOpenFinancialGoalModal = (goal = null) => {
    if (goal) {
      console.log('[FRONTEND] Abrindo modal para editar meta:', {
        id: goal.id,
        name: goal.name,
        tag: goal.tag || '(vazio)',
        tagType: typeof goal.tag,
      });
      setEditingFinancialGoal(goal);
      setFinancialGoalForm({
        name: goal.name || '',
        type: goal.type || 'custom',
        targetAmount: goal.target_amount?.toString() || '',
        currentAmount: goal.current_amount?.toString() || '',
        description: goal.description || '',
        targetDate: goal.target_date || '',
        tag: goal.tag || '',
      });
    } else {
      setEditingFinancialGoal(null);
      setFinancialGoalForm({
        name: '',
        type: 'custom',
        targetAmount: '',
        currentAmount: '',
        description: '',
        targetDate: '',
        tag: '',
      });
    }
    setShowFinancialGoalModal(true);
  };

  const handleCloseFinancialGoalModal = () => {
    setShowFinancialGoalModal(false);
    setEditingFinancialGoal(null);
    setFinancialGoalForm({
      name: '',
      type: 'custom',
      targetAmount: '',
      currentAmount: '',
      description: '',
      targetDate: '',
      tag: '',
    });
  };

  const handleSaveFinancialGoal = async () => {
    try {
      const goalData = {
        name: financialGoalForm.name,
        type: financialGoalForm.type,
        targetAmount: parseFloat(financialGoalForm.targetAmount),
        currentAmount: parseFloat(financialGoalForm.currentAmount) || 0,
        description: financialGoalForm.description,
        targetDate: financialGoalForm.targetDate || null,
        tag: financialGoalForm.tag && financialGoalForm.tag.trim() !== '' ? financialGoalForm.tag.trim() : null,
      };

      console.log('[FRONTEND] Salvando meta financeira:', {
        ...goalData,
        tag: goalData.tag || '(vazio)',
      });

      if (editingFinancialGoal) {
        await api.updateFinancialGoal(editingFinancialGoal.id, goalData);
      } else {
        await api.createFinancialGoal(goalData);
      }

      handleCloseFinancialGoalModal();
      await loadFinancialGoals();
    } catch (err) {
      console.error('Erro ao salvar meta financeira:', err);
      alert('Erro ao salvar meta: ' + err.message);
    }
  };

  const handleDeleteFinancialGoal = async (goalId) => {
    if (!confirm('Tem certeza que deseja deletar esta meta?')) {
      return;
    }

    try {
      await api.deleteFinancialGoal(goalId);
      await loadFinancialGoals();
    } catch (err) {
      console.error('Erro ao deletar meta:', err);
      alert('Erro ao deletar meta: ' + err.message);
    }
  };

  // Gastos Previstos
  const [expectedExpensesData, setExpectedExpensesData] = useState({
    expenses: [],
    loading: false,
    error: null,
  });

  const [showExpectedExpenseModal, setShowExpectedExpenseModal] = useState(false);
  const [editingExpectedExpense, setEditingExpectedExpense] = useState(null);
  const [expectedExpenseForm, setExpectedExpenseForm] = useState({
    name: '',
    amount: '',
    endDate: '',
    paymentMethod: 'Pix',
  });

  const loadExpectedExpenses = async () => {
    try {
      setExpectedExpensesData(prev => ({ ...prev, loading: true, error: null }));
      // Passar apenas o valor do período, sem o "?"
      const periodParam = filters.period && filters.period !== 'all' ? filters.period : '';
      const data = await api.getExpectedExpenses(periodParam);
      setExpectedExpensesData({
        expenses: data.expenses || [],
        loading: false,
        error: null,
      });
    } catch (err) {
      console.error('Erro ao buscar gastos previstos:', err);
      setExpectedExpensesData(prev => ({ ...prev, loading: false, error: err.message }));
    }
  };

  useEffect(() => {
    if (activeTab === 'expected-expenses') {
      loadExpectedExpenses();
      // Inserir regras padrão na primeira vez (silenciosamente)
      api.seedDefaultValidationRules().catch(() => {
        // Ignorar erro se já existirem
      });
    }
  }, [activeTab, filters.period]);

  const handleOpenExpectedExpenseModal = (expense = null) => {
    if (expense) {
      setEditingExpectedExpense(expense);
      setExpectedExpenseForm({
        name: expense.name || '',
        amount: expense.amount.toString(),
        endDate: expense.endDate || '',
        paymentMethod: expense.paymentMethod || 'Pix',
      });
    } else {
      setEditingExpectedExpense(null);
      setExpectedExpenseForm({
        name: '',
        amount: '',
        endDate: '',
        paymentMethod: 'Pix',
      });
    }
    setShowExpectedExpenseModal(true);
  };

  const handleCloseExpectedExpenseModal = () => {
    setShowExpectedExpenseModal(false);
    setEditingExpectedExpense(null);
    setExpectedExpenseForm({
      name: '',
      amount: '',
      endDate: '',
      paymentMethod: 'Pix',
    });
  };

  const handleSaveExpectedExpense = async () => {
    try {
      const expenseData = {
        name: expectedExpenseForm.name,
        amount: parseFloat(expectedExpenseForm.amount),
        endDate: expectedExpenseForm.endDate || null,
        paymentMethod: expectedExpenseForm.paymentMethod,
      };

      if (editingExpectedExpense) {
        await api.updateExpectedExpense(editingExpectedExpense.id, expenseData);
      } else {
        await api.createExpectedExpense(expenseData);
      }

      handleCloseExpectedExpenseModal();
      await loadExpectedExpenses();
    } catch (err) {
      console.error('Erro ao salvar gasto previsto:', err);
      alert('Erro ao salvar gasto previsto: ' + err.message);
    }
  };

  const handleDeleteExpectedExpense = async (expenseId) => {
    if (!confirm('Tem certeza que deseja deletar este gasto previsto?')) {
      return;
    }

    try {
      await api.deleteExpectedExpense(expenseId);
      await loadExpectedExpenses();
    } catch (err) {
      console.error('Erro ao deletar gasto previsto:', err);
      alert('Erro ao deletar gasto previsto: ' + err.message);
    }
  };

  const handleMarkAsPaid = async (expenseId, isPaid) => {
    try {
      // Passar o período atual para marcar como pago apenas neste período
      const periodParam = filters.period && filters.period !== 'all' ? filters.period : '';
      await api.markExpectedExpenseAsPaid(expenseId, !isPaid, periodParam);
      await loadExpectedExpenses();
    } catch (err) {
      console.error('Erro ao marcar gasto como pago:', err);
      alert('Erro ao marcar gasto: ' + err.message);
    }
  };

  useEffect(() => {
    if (activeTab === 'loans') {
      loadLoans();
    }
  }, [activeTab]);

  // Due Dates (Calendário)
  const loadDueDates = async () => {
    try {
      setDueDatesData(prev => ({ ...prev, loading: true, error: null }));
      const now = new Date();
      const data = await api.getDueDates(now.getMonth() + 1, now.getFullYear());
      setDueDatesData({
        calendar: data.calendar || {},
        all: data.all || [],
        loading: false,
        error: null,
      });
    } catch (err) {
      console.error('Erro ao buscar vencimentos:', err);
      setDueDatesData(prev => ({ ...prev, loading: false, error: err.message }));
    }
  };


  const handleOpenDueDateModal = (dueDate = null) => {
    if (dueDate) {
      setEditingDueDate(dueDate);
      setDueDateForm({
        name: dueDate.name || '',
        type: dueDate.type || 'custom',
        amount: dueDate.amount?.toString() || '',
        due_day: dueDate.due_day?.toString() || '',
      });
    } else {
      setEditingDueDate(null);
      setDueDateForm({
        name: '',
        type: 'custom',
        amount: '',
        due_day: '',
      });
    }
    setShowDueDateModal(true);
  };

  const handleSaveDueDate = async () => {
    try {
      const dueDateData = {
        name: dueDateForm.name,
        type: dueDateForm.type,
        amount: dueDateForm.amount ? parseFloat(dueDateForm.amount) : null,
        due_day: parseInt(dueDateForm.due_day),
      };

      if (editingDueDate) {
        await api.updateDueDate(editingDueDate.id, dueDateData);
      } else {
        await api.createDueDate(dueDateData);
      }

      setShowDueDateModal(false);
      setEditingDueDate(null);
      await loadDueDates();
    } catch (err) {
      console.error('Erro ao salvar vencimento:', err);
      alert('Erro ao salvar: ' + err.message);
    }
  };

  const handleDeleteDueDate = async (id) => {
    if (!confirm('Tem certeza que deseja deletar este vencimento?')) {
      return;
    }
    try {
      await api.deleteDueDate(id);
      await loadDueDates();
    } catch (err) {
      console.error('Erro ao deletar vencimento:', err);
      alert('Erro ao deletar: ' + err.message);
    }
  };

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getDashboard(filters);
      setDashboardData(data);
    } catch (err) {
      setError(err.message || 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateCategory = async (transactionId) => {
    if (!newCategory.trim()) return;
    try {
      await api.updateCategory(transactionId, newCategory.trim());
      setEditingCategory(null);
      setNewCategory('');
      await loadDashboard();
    } catch (err) {
      setError(err.message);
    }
  };

  const formatCurrency = (value) => {
    if (hideValues) return '••••••';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatDate = (dateString) => {
    return DateTime.fromISO(dateString).toLocaleString(DateTime.DATE_SHORT);
  };

  // Transações filtradas por categoria
  const filteredTransactions = useMemo(() => {
    if (!dashboardData?.transactions) return [];
    if (filters.category === 'all') return dashboardData.transactions;
    return dashboardData.transactions.filter(tx => tx.category === filters.category);
  }, [dashboardData?.transactions, filters.category]);

  const { creditCardTransactions, bankTransactions } = useMemo(() => {
    const txs = filteredTransactions;
    const credit = txs.filter(tx => tx.account_type === 'CREDIT');
    const bank = txs.filter(tx => tx.account_type !== 'CREDIT');
    return { creditCardTransactions: credit, bankTransactions: bank };
  }, [filteredTransactions]);

  // Lista de categorias únicas
  const categories = useMemo(() => {
    if (!dashboardData?.transactions) return [];
    const cats = [...new Set(dashboardData.transactions.map(tx => tx.category))];
    return cats.sort();
  }, [dashboardData?.transactions]);

  // Saldos e cálculos
  const bankAccountBalancePluggy = realBalances.bankBalance || 0;
  const periodIncome = dashboardData?.periodIncome || 0;
  const periodExpenses = dashboardData?.periodExpenses || 0;
  const periodMovement = dashboardData?.periodMovement || (periodIncome - periodExpenses);
  const backendInitialBalance = dashboardData?.initialBalance || 0;
  const backendEndOfPeriodBalance = dashboardData?.endOfPeriodBalance || 0;
  const currentBankBalance = dashboardData?.currentBankBalance || 0;
  const adjustmentFactor = bankAccountBalancePluggy - currentBankBalance;
  const endOfPeriodBalance = backendEndOfPeriodBalance + adjustmentFactor;
  const initialBalance = backendInitialBalance + adjustmentFactor;

  // Dados para gráfico de barras (top categorias)
  const topCategories = useMemo(() => {
    if (!dashboardData?.categoryTotals) return [];
    return dashboardData.categoryTotals.slice(0, 8);
  }, [dashboardData?.categoryTotals]);

  // Dados para gráfico de evolução (últimos dias)
  const dailyData = useMemo(() => {
    if (!dashboardData?.transactions) return [];
    const dailyMap = {};
    dashboardData.transactions.forEach(tx => {
      const day = tx.date.slice(0, 10);
      if (!dailyMap[day]) dailyMap[day] = { day, gastos: 0, entradas: 0 };
      if (tx.amount < 0) dailyMap[day].gastos += Math.abs(tx.amount);
      else dailyMap[day].entradas += tx.amount;
    });
    return Object.values(dailyMap).sort((a, b) => a.day.localeCompare(b.day)).slice(-15);
  }, [dashboardData?.transactions]);

  // Projeção de Entradas (baseado em salários/renda recorrente)
  const incomeProjection = useMemo(() => {
    if (!dashboardData?.transactions) return { monthlyAverage: 0, projection: [] };
    
    // Buscar todas as transações de entrada dos últimos 6 meses
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const minDate = sixMonthsAgo.toISOString();
    
    // Filtrar apenas transações que parecem ser salários/renda recorrente
    // Palavras-chave comuns em salários
    const salaryKeywords = [
      'salario', 'salário', 'sal', 'folha', 'pagamento', 'pagto',
      'remuneracao', 'remuneração', 'prolabore', 'ordenado',
      'deposito', 'depósito', 'credito', 'crédito', 'transferencia', 'transferência'
    ];
    
    const allIncomeTransactions = dashboardData.transactions.filter(tx => 
      tx.amount > 0 && 
      new Date(tx.date) >= sixMonthsAgo &&
      (tx.account_type === 'BANK' || !tx.account_type)
    );
    
    // Identificar salários: valores recorrentes similares ou descrições com palavras-chave
    const salaryPatterns = {};
    allIncomeTransactions.forEach(tx => {
      const desc = tx.description.toLowerCase();
      const isSalaryKeyword = salaryKeywords.some(keyword => desc.includes(keyword));
      
      // Se tem palavra-chave de salário, considerar
      if (isSalaryKeyword) {
        const amount = Math.round(tx.amount / 100) * 100; // Arredondar para centenas
        if (!salaryPatterns[amount]) {
          salaryPatterns[amount] = [];
        }
        salaryPatterns[amount].push(tx);
      }
    });
    
    // Encontrar o padrão mais comum (salário principal)
    let mainSalaryPattern = null;
    let maxCount = 0;
    Object.keys(salaryPatterns).forEach(amount => {
      if (salaryPatterns[amount].length > maxCount) {
        maxCount = salaryPatterns[amount].length;
        mainSalaryPattern = parseFloat(amount);
      }
    });
    
    // Se não encontrou padrão claro, usar valores recorrentes similares
    if (!mainSalaryPattern || maxCount < 2) {
      // Agrupar por valores similares (diferença de até 5%)
      const valueGroups = {};
      allIncomeTransactions.forEach(tx => {
        const rounded = Math.round(tx.amount / 100) * 100;
        if (!valueGroups[rounded]) {
          valueGroups[rounded] = [];
        }
        valueGroups[rounded].push(tx);
      });
      
      // Encontrar o valor mais recorrente (pelo menos 3 ocorrências)
      Object.keys(valueGroups).forEach(amount => {
        if (valueGroups[amount].length >= 3 && valueGroups[amount].length > maxCount) {
          maxCount = valueGroups[amount].length;
          mainSalaryPattern = parseFloat(amount);
        }
      });
    }
    
    // Se ainda não encontrou, usar a maior transação recorrente dos últimos meses
    if (!mainSalaryPattern) {
      // Agrupar por mês e pegar a maior entrada de cada mês
      const monthlyMax = {};
      allIncomeTransactions.forEach(tx => {
        const date = new Date(tx.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (!monthlyMax[monthKey] || tx.amount > monthlyMax[monthKey]) {
          monthlyMax[monthKey] = tx.amount;
        }
      });
      
      const maxValues = Object.values(monthlyMax);
      if (maxValues.length > 0) {
        // Usar a mediana dos maiores valores mensais
        maxValues.sort((a, b) => a - b);
        mainSalaryPattern = maxValues[Math.floor(maxValues.length / 2)];
      }
    }
    
    // Agrupar salários por mês (usando o padrão identificado ou valores próximos)
    const monthlyIncome = {};
    allIncomeTransactions.forEach(tx => {
      // Considerar apenas transações que são salários (valor similar ao padrão ou tem palavra-chave)
      const desc = tx.description.toLowerCase();
      const isSalaryKeyword = salaryKeywords.some(keyword => desc.includes(keyword));
      const roundedAmount = Math.round(tx.amount / 100) * 100;
      const isSimilarSalary = mainSalaryPattern && Math.abs(roundedAmount - mainSalaryPattern) <= (mainSalaryPattern * 0.1);
      
      if (isSalaryKeyword || isSimilarSalary || (mainSalaryPattern && Math.abs(tx.amount - mainSalaryPattern) <= (mainSalaryPattern * 0.15))) {
        const date = new Date(tx.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (!monthlyIncome[monthKey]) {
          monthlyIncome[monthKey] = [];
        }
        monthlyIncome[monthKey].push(tx.amount);
      }
    });
    
    // Calcular total por mês (soma dos salários do mês)
    const monthlyTotals = {};
    Object.keys(monthlyIncome).forEach(month => {
      monthlyTotals[month] = monthlyIncome[month].reduce((a, b) => a + b, 0);
    });
    
    // Calcular média mensal apenas dos meses que têm salários identificados
    const monthlyValues = Object.values(monthlyTotals);
    const monthlyAverage = monthlyValues.length > 0 
      ? monthlyValues.reduce((a, b) => a + b, 0) / monthlyValues.length 
      : (mainSalaryPattern || 0);
    
    // Criar projeção para próximos 6 meses
    const now = new Date();
    const projection = [];
    for (let i = 1; i <= 6; i++) {
      const futureDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
      projection.push({
        month: futureDate.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }),
        monthKey: `${futureDate.getFullYear()}-${String(futureDate.getMonth() + 1).padStart(2, '0')}`,
        projectedIncome: monthlyAverage,
        date: futureDate
      });
    }
    
    return {
      monthlyAverage,
      projection,
      historicalMonths: Object.keys(monthlyTotals).map(key => ({
        month: key,
        income: monthlyTotals[key]
      })).sort((a, b) => a.month.localeCompare(b.month))
    };
  }, [dashboardData?.transactions]);

  // Loading screen
  if (loading && !dashboardData) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0a0a0f]">
        <div className="text-center">
          <div className="w-16 h-16 border-2 border-[#00D4FF]/30 border-t-[#00D4FF] rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[#64748b] text-sm tracking-widest uppercase">Carregando</p>
        </div>
      </div>
    );
  }

  // Theme classes
  const theme = {
    bg: darkMode ? 'bg-[#0a0a0f]' : 'bg-[#f8fafc]',
    text: darkMode ? 'text-white' : 'text-[#1e293b]',
    textMuted: darkMode ? 'text-[#64748b]' : 'text-[#64748b]',
    border: darkMode ? 'border-white/5' : 'border-black/5',
    card: darkMode ? 'bg-white/[0.02]' : 'bg-white',
    cardBorder: darkMode ? 'border-white/5' : 'border-black/5',
    cardHover: darkMode ? 'hover:bg-white/[0.04]' : 'hover:bg-black/[0.02]',
    header: darkMode ? 'bg-[#0a0a0f]/80' : 'bg-white/80',
    input: darkMode ? 'bg-white/5 border-white/10' : 'bg-black/5 border-black/10',
    inputText: darkMode ? 'text-white' : 'text-[#1e293b]',
    gradient1: darkMode ? 'bg-[#00D4FF]/5' : 'bg-[#00D4FF]/10',
    gradient2: darkMode ? 'bg-[#7B61FF]/5' : 'bg-[#7B61FF]/10',
  };

  return (
    <div className={clsx("min-h-screen transition-colors duration-300", theme.bg, theme.text, "selection:bg-[#00D4FF]/20", !darkMode && "light-mode")}>
      
      {/* Gradient background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className={clsx("absolute -top-40 -right-40 w-80 h-80 rounded-full blur-3xl", theme.gradient1)}></div>
        <div className={clsx("absolute -bottom-40 -left-40 w-80 h-80 rounded-full blur-3xl", theme.gradient2)}></div>
      </div>

      {/* Header */}
      <header className={clsx("relative z-10 border-b backdrop-blur-xl", theme.border, theme.header)}>
        <div className="px-8 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              {(processedLogoSrc || logoSrc) && !logoError ? (
                <div 
                  className="w-40 h-40 overflow-hidden relative"
                  style={{
                    backgroundColor: 'transparent'
                  }}
                >
                  <img 
                    src={processedLogoSrc || logoSrc} 
                    alt="Flux Logo" 
                    className="w-full h-full object-contain"
                    style={{
                      backgroundColor: 'transparent',
                      display: 'block'
                    }}
                    onError={() => setLogoError(true)}
                  />
                </div>
              ) : (
                <div className="w-40 h-40 bg-gradient-to-br from-[#00D4FF] to-[#7B61FF] rounded-2xl flex items-center justify-center">
                  <span className="text-5xl font-bold text-white">F</span>
                </div>
              )}
            </div>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Flux</h1>
              <p className={clsx("text-lg", theme.textMuted)}>Financial Control</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Hide Values Button */}
            <button
              onClick={() => setHideValues(!hideValues)}
              className={clsx(
                "w-10 h-10 rounded-lg flex items-center justify-center transition-all",
                darkMode ? "hover:bg-white/5" : "hover:bg-black/5"
              )}
              title={hideValues ? "Mostrar valores" : "Ocultar valores"}
            >
              {hideValues ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>

            {/* Dark/Light Mode Button */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={clsx(
                "w-10 h-10 rounded-lg flex items-center justify-center transition-all",
                darkMode ? "hover:bg-white/5" : "hover:bg-black/5"
              )}
              title={darkMode ? "Modo claro" : "Modo escuro"}
            >
              {darkMode ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>

            <div className={clsx("w-px h-6 mx-2", darkMode ? "bg-white/10" : "bg-black/10")}></div>

            <button
              onClick={() => setShowCredentialsModal(true)}
              className={clsx(
                "px-4 py-2 text-sm rounded-lg transition-all",
                theme.textMuted,
                darkMode ? "hover:text-white hover:bg-white/5" : "hover:text-black hover:bg-black/5"
              )}
            >
              Settings
            </button>
            <button
              onClick={() => setShowPluggyItemsModal(true)}
              className={clsx(
                "px-4 py-2 text-sm rounded-lg border transition-all",
                theme.input,
                theme.inputText
              )}
            >
              Accounts
            </button>
          </div>
        </div>

        {/* Navigation Tabs com Card Saldo Atual */}
        <div className="px-8 relative">
          <div className="flex gap-1 items-center justify-between">
            <div className="flex gap-1">
              {['overview', 'transactions', 'loans', 'limits', 'goals', 'expected-expenses', 'calendar', 'analytics'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={clsx(
                    "px-5 py-3 text-sm font-medium transition-all relative",
                    activeTab === tab 
                      ? theme.text 
                      : clsx(theme.textMuted, darkMode ? "hover:text-white" : "hover:text-black")
                  )}
                >
                  {tab === 'overview' ? 'Visão Geral' : tab === 'transactions' ? 'Transações' : tab === 'loans' ? 'Empréstimos' : tab === 'limits' ? 'Limites' : tab === 'goals' ? 'Metas' : tab === 'expected-expenses' ? 'Gastos Previstos' : tab === 'calendar' ? 'Vencimentos' : 'Análises'}
                  {activeTab === tab && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#00D4FF] to-[#7B61FF]"></div>
                  )}
                </button>
              ))}
            </div>
            
            {/* Card Saldo em Conta - Canto Superior Direito (abaixo do botão Accounts) */}
            {dashboardData && (
              <div className="absolute -top-12 right-8 z-20">
                <div className={clsx(
                  "relative overflow-visible rounded-lg p-2.5 border transition-all duration-300",
                  "bg-gradient-to-br from-[#00D4FF]/20 via-[#00D4FF]/10 to-transparent",
                  "border-[#00D4FF]/30 shadow-md shadow-[#00D4FF]/10",
                  "hover:shadow-lg hover:shadow-[#00D4FF]/20",
                  "w-40"
                )}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <div className="w-0.5 h-4 bg-gradient-to-b from-[#00D4FF] to-transparent rounded-full"></div>
                      <div>
                        <h3 className={clsx("text-[9px] font-medium uppercase tracking-wider text-[#00D4FF]")}>
                          Saldo em Conta
                        </h3>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-1 h-1 bg-[#00FF94] rounded-full animate-pulse"></div>
                      <button
                        onClick={() => setExpandedBalance(!expandedBalance)}
                        className={clsx(
                          "px-1.5 py-0.5 rounded text-[9px] font-medium transition-all duration-200",
                          "bg-[#00D4FF]/20 text-[#00D4FF] hover:bg-[#00D4FF]/30",
                          "border border-[#00D4FF]/30 hover:border-[#00D4FF]/50"
                        )}
                      >
                        {expandedBalance ? '▲' : '▼'}
                      </button>
                    </div>
                  </div>
                  
                  <p className={clsx("text-xl font-bold text-[#00D4FF] mb-1")}>
                    {formatCurrency(bankAccountBalancePluggy || currentBankBalance)}
                  </p>
                
                  {/* Detalhes expandidos */}
                  {expandedBalance && (
                    <div className="mt-2 pt-2 border-t border-[#00D4FF]/20">
                      <h4 className={clsx("text-[9px] font-medium uppercase tracking-wider text-[#00D4FF] mb-1.5")}>
                        Por Conta
                      </h4>
                    {(() => {
                      const bankAccounts = (realBalances.accounts || []).filter(acc => {
                        const accType = acc.accountType || acc.type || acc.account_type;
                        const subtype = acc.subtype || acc.accountSubtype;
                        // Excluir cartões de crédito explicitamente
                        if (accType === 'CREDIT' || acc.account_type === 'CREDIT' || subtype === 'CREDIT_CARD') {
                          return false;
                        }
                        // Incluir apenas contas bancárias
                        return accType === 'BANK' || accType === 'CHECKING_ACCOUNT' || accType === 'SAVINGS_ACCOUNT' || 
                               (acc.type && acc.type !== 'CREDIT' && acc.account_type !== 'CREDIT');
                      });
                      
                      if (bankAccounts.length === 0) {
                        return (
                          <p className={clsx("text-[9px] text-[#64748b] text-center py-1.5")}>
                            Nenhuma conta encontrada
                          </p>
                        );
                      }

                      const grouped = bankAccounts.reduce((acc, account) => {
                        const key = `${account.bankName || account.bank_name || 'Desconhecido'}_${account.ownerName || account.owner_name || 'Desconhecido'}`;
                        if (!acc[key]) {
                          acc[key] = {
                            bankName: account.bankName || account.bank_name || 'Desconhecido',
                            ownerName: account.ownerName || account.owner_name || 'Desconhecido',
                            accounts: [],
                            total: 0
                          };
                        }
                        acc[key].accounts.push(account);
                        acc[key].total += account.balance || 0;
                        return acc;
                      }, {});

                      return (
                        <div className="space-y-1.5 max-h-56 overflow-y-auto">
                          {Object.values(grouped).map((group, idx) => (
                            <div 
                              key={idx}
                              className={clsx(
                                "rounded-md p-1.5 border transition-all duration-200",
                                darkMode ? "bg-white/5 border-white/10" : "bg-black/5 border-black/10"
                              )}
                            >
                              <div className="flex items-center justify-between mb-0.5">
                                <div className="flex-1 min-w-0">
                                  <p className={clsx("text-[9px] font-medium truncate", theme.text)}>
                                    {group.bankName}
                                  </p>
                                  <p className={clsx("text-[8px] text-[#64748b] truncate")}>
                                    {group.ownerName}
                                  </p>
                                </div>
                                <p className={clsx("text-xs font-bold text-[#00D4FF] ml-1.5")}>
                                  {formatCurrency(group.total)}
                                </p>
                              </div>
                              
                              {group.accounts.length > 1 && (
                                <div className="mt-1.5 pt-1.5 border-t border-white/5 space-y-0.5">
                                  {group.accounts.map((account, accIdx) => (
                                    <div key={accIdx} className="flex items-center justify-between text-[8px]">
                                      <span className={clsx("text-[#64748b] truncate flex-1")}>
                                        {account.accountName || account.name || 'Conta'}
                                      </span>
                                      <span className={clsx("font-medium ml-1.5", theme.text)}>
                                        {formatCurrency(account.balance || 0)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>
          )}
          </div>
        </div>
      </header>

      {/* Filters Bar */}
      {dashboardData?.filters && (
        <div className={clsx("relative z-10 px-8 py-4 border-b flex items-center gap-4 flex-wrap", theme.border)}>
          <div className="flex items-center gap-2 mr-4">
            <div className="w-1.5 h-1.5 rounded-full bg-[#00D4FF]"></div>
            <span className={clsx("text-xs uppercase tracking-widest", theme.textMuted)}>Filtros</span>
          </div>
          
          
          {/* Period */}
          <select
            value={filters.period}
            onChange={(e) => setFilters({ ...filters, period: e.target.value })}
            className={clsx("px-4 py-2 text-sm rounded-lg focus:outline-none focus:border-[#00D4FF]/50 appearance-none cursor-pointer", theme.input, theme.inputText)}
          >
            {dashboardData.filters.periods.map((p) => (
              <option key={p.value} value={p.value} className={darkMode ? "bg-[#1a1a2e]" : "bg-white"}>{p.label}</option>
            ))}
          </select>

          {/* Account Type */}
          <select
            value={filters.accountType}
            onChange={(e) => setFilters({ ...filters, accountType: e.target.value })}
            className={clsx("px-4 py-2 text-sm rounded-lg focus:outline-none focus:border-[#00D4FF]/50 appearance-none cursor-pointer", theme.input, theme.inputText)}
          >
            {dashboardData.filters.accountTypes.map((t) => (
              <option key={t.value} value={t.value} className={darkMode ? "bg-[#1a1a2e]" : "bg-white"}>{t.label}</option>
            ))}
          </select>

          {/* Bank */}
          <select
            value={filters.bankName}
            onChange={(e) => setFilters({ ...filters, bankName: e.target.value })}
            className={clsx("px-4 py-2 text-sm rounded-lg focus:outline-none focus:border-[#00D4FF]/50 appearance-none cursor-pointer", theme.input, theme.inputText)}
          >
            {dashboardData.filters.banks.map((b) => (
              <option key={b.value} value={b.value} className={darkMode ? "bg-[#1a1a2e]" : "bg-white"}>{b.label}</option>
            ))}
          </select>

          {/* Owner */}
          <select
            value={filters.ownerName}
            onChange={(e) => setFilters({ ...filters, ownerName: e.target.value })}
            className={clsx("px-4 py-2 text-sm rounded-lg focus:outline-none focus:border-[#00D4FF]/50 appearance-none cursor-pointer", theme.input, theme.inputText)}
          >
            {dashboardData.filters.owners.map((o) => (
              <option key={o.value} value={o.value} className={darkMode ? "bg-[#1a1a2e]" : "bg-white"}>{o.label}</option>
            ))}
          </select>

          {/* Category Filter */}
          <select
            value={filters.category}
            onChange={(e) => setFilters({ ...filters, category: e.target.value })}
            className={clsx("px-4 py-2 text-sm rounded-lg focus:outline-none focus:border-[#00D4FF]/50 appearance-none cursor-pointer", theme.input, theme.inputText)}
          >
            <option value="all" className={darkMode ? "bg-[#1a1a2e]" : "bg-white"}>Todas Categorias</option>
            {categories.map((cat) => (
              <option key={cat} value={cat} className={darkMode ? "bg-[#1a1a2e]" : "bg-white"}>{cat}</option>
            ))}
          </select>

          {/* Clear button */}
          {(filters.period !== getCurrentPeriod() || filters.accountType !== 'all' || filters.bankName !== 'all' || filters.ownerName !== 'all' || filters.category !== 'all') && (
            <button
              onClick={() => setFilters({ period: getCurrentPeriod(), accountType: 'all', bankName: 'all', ownerName: 'all', category: 'all' })}
              className="px-4 py-2 text-sm text-[#00D4FF] hover:bg-[#00D4FF]/10 rounded-lg transition-all"
            >
              Limpar filtros
            </button>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mx-8 mt-4 p-4 bg-[#FF4757]/10 border border-[#FF4757]/20 rounded-lg">
          <div className="flex items-center gap-3">
            <span className="text-[#FF4757]">⚠</span>
            <p className="flex-1 text-sm text-[#FF4757]">{error}</p>
            <button onClick={() => setError(null)} className="text-[#FF4757]/60 hover:text-[#FF4757]">✕</button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="relative z-10 p-8">
        {loading && (
          <div className="fixed inset-0 bg-[#0a0a0f]/80 backdrop-blur-sm flex items-center justify-center z-40">
            <div className="w-10 h-10 border-2 border-[#00D4FF]/30 border-t-[#00D4FF] rounded-full animate-spin"></div>
          </div>
        )}
        
        {dashboardData && activeTab === 'overview' && (
          <>
            {/* Stats Grid - Layout Original */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
              {[
                { label: 'Saldo Inicial', value: initialBalance, icon: '↗', positive: initialBalance >= 0 },
                { label: 'Entradas', value: periodIncome, icon: '+', positive: true },
                { label: 'Gastos', value: periodExpenses, icon: '−', positive: false },
                { label: 'Saldo Final', value: endOfPeriodBalance, icon: '=', positive: endOfPeriodBalance >= 0 },
                { label: 'Cartões', value: realBalances.creditCardBalance, icon: '▣', positive: false },
              ].map((stat, idx) => (
                <div key={idx} className={clsx("group relative rounded-2xl p-5 transition-all duration-300 border", theme.card, theme.cardBorder, theme.cardHover)}>
                  <div className="flex items-center justify-between mb-3">
                    <span className={clsx("text-xs uppercase tracking-wider", theme.textMuted)}>{stat.label}</span>
                    <span className={clsx(
                      "w-6 h-6 rounded-md flex items-center justify-center text-xs",
                      stat.positive ? "bg-[#00FF94]/10 text-[#00FF94]" : "bg-[#FF4757]/10 text-[#FF4757]"
                    )}>
                      {stat.icon}
                    </span>
                  </div>
                  <p className={clsx(
                    "text-xl font-semibold tracking-tight",
                    stat.positive ? theme.text : "text-[#FF4757]"
                  )}>
                    {formatCurrency(stat.value)}
                  </p>
                  {stat.isLive && (
                    <div className="absolute top-3 right-3 w-2 h-2 bg-[#00FF94] rounded-full animate-pulse"></div>
                  )}
                </div>
              ))}
            </div>

            {/* Credit Card Bills */}
            {realBalances.creditCardBillsDetailed?.length > 0 && (
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-1 h-6 bg-gradient-to-b from-[#7B61FF] to-transparent rounded-full"></div>
                  <h2 className={clsx("text-sm font-medium uppercase tracking-wider", darkMode ? "text-white/80" : "text-black/80")}>Faturas dos Cartões</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {realBalances.creditCardBillsDetailed.map((bill, idx) => (
                    <div 
                      key={idx} 
                      className={clsx(
                        "relative overflow-hidden rounded-2xl p-5 border transition-all duration-300 hover:scale-[1.02]",
                        bill.isOpen 
                          ? "bg-gradient-to-br from-[#FFB800]/10 to-transparent border-[#FFB800]/20" 
                          : clsx(theme.card, theme.cardBorder)
                      )}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="text-xs text-[#64748b]">{bill.bankName}</p>
                          <p className={clsx("text-sm font-medium mt-0.5", theme.text)}>{bill.ownerName}</p>
                        </div>
                        {bill.isOpen ? (
                          <span className="px-2 py-0.5 text-[10px] bg-[#FFB800]/20 text-[#FFB800] rounded-full uppercase tracking-wider">
                            Aberta
                          </span>
                        ) : bill.dueDate && (
                          <span className="text-[10px] text-[#64748b]">
                            Vence {new Date(bill.dueDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                          </span>
                        )}
                      </div>
                      <p className={clsx(
                        "text-2xl font-bold",
                        bill.isOpen ? "text-[#FFB800]" : theme.text
                      )}>
                        {formatCurrency(bill.total)}
                      </p>
                      {bill.isOpen && bill.ciclo && (
                        <p className="text-[10px] text-[#64748b] mt-2">Ciclo: {bill.ciclo}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Category Donut */}
              <div className={clsx("rounded-2xl p-6 border", theme.card, theme.cardBorder)}>
                <h3 className={clsx("text-sm font-medium uppercase tracking-wider mb-6", darkMode ? "text-white/80" : "text-black/80")}>Gastos por Categoria</h3>
                {topCategories.length > 0 ? (
                  <div className="flex items-center gap-6">
                    <div className="w-48 h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={topCategories}
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={80}
                            paddingAngle={3}
                            dataKey="total"
                            stroke="none"
                          >
                            {topCategories.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip 
                            formatter={(value) => formatCurrency(value)}
                            contentStyle={{ 
                              backgroundColor: '#1a1a2e', 
                              border: '1px solid rgba(255,255,255,0.1)', 
                              borderRadius: '12px',
                              boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
                            }}
                            itemStyle={{ color: '#fff' }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex-1 space-y-2">
                      {topCategories.map((cat, idx) => (
                        <div key={idx} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}></div>
                            <span className="text-[#64748b]">{cat.category}</span>
                          </div>
                          <span className="text-white font-medium">{formatCurrency(cat.total)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="h-48 flex items-center justify-center text-[#64748b]">Sem dados</div>
                )}
              </div>

              {/* Bar Chart - Top Categories */}
              <div className={clsx("rounded-2xl p-6 border", theme.card, theme.cardBorder)}>
                <h3 className={clsx("text-sm font-medium uppercase tracking-wider mb-6", darkMode ? "text-white/80" : "text-black/80")}>Top Gastos</h3>
                {topCategories.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={topCategories.slice(0, 6)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis type="number" tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
                      <YAxis type="category" dataKey="category" tick={{ fill: '#64748b', fontSize: 11 }} width={100} />
                      <Tooltip 
                        formatter={(value) => formatCurrency(value)}
                        contentStyle={{ 
                          backgroundColor: '#1a1a2e', 
                          border: '1px solid rgba(255,255,255,0.1)', 
                          borderRadius: '12px',
                          boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
                        }}
                        itemStyle={{ color: '#fff' }}
                        labelStyle={{ color: '#fff' }}
                      />
                      <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                        {topCategories.slice(0, 6).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[200px] flex items-center justify-center text-[#64748b]">Sem dados</div>
                )}
              </div>
            </div>

            {/* Daily Evolution Chart */}
            {dailyData.length > 0 && (
              <div className={clsx("rounded-2xl p-6 mb-8 border", theme.card, theme.cardBorder)}>
                <h3 className={clsx("text-sm font-medium uppercase tracking-wider mb-6", darkMode ? "text-white/80" : "text-black/80")}>Evolução Diária</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={dailyData}>
                    <defs>
                      <linearGradient id="colorEntradas" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#00FF94" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#00FF94" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorGastos" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#FF4757" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#FF4757" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis 
                      dataKey="day" 
                      tick={{ fill: '#64748b', fontSize: 10 }} 
                      tickFormatter={(v) => v.slice(8, 10)}
                    />
                    <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                    <Tooltip 
                      formatter={(value) => formatCurrency(value)}
                      labelFormatter={(label) => DateTime.fromISO(label).toLocaleString(DateTime.DATE_MED)}
                      contentStyle={{ 
                        backgroundColor: '#1a1a2e', 
                        border: '1px solid rgba(255,255,255,0.1)', 
                        borderRadius: '12px' 
                      }}
                    />
                    <Area type="monotone" dataKey="entradas" stroke="#00FF94" fillOpacity={1} fill="url(#colorEntradas)" strokeWidth={2} />
                    <Area type="monotone" dataKey="gastos" stroke="#FF4757" fillOpacity={1} fill="url(#colorGastos)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}

        {/* Transactions Tab */}
        {dashboardData && activeTab === 'transactions' && (
          <div className="space-y-6">
            {filters.accountType === 'all' ? (
              <>
                <TransactionTable 
                  transactions={bankTransactions} 
                  title="Conta Corrente" 
                  formatCurrency={formatCurrency} 
                  formatDate={formatDate} 
                  editingCategory={editingCategory} 
                  setEditingCategory={setEditingCategory} 
                  newCategory={newCategory} 
                  setNewCategory={setNewCategory} 
                  handleUpdateCategory={handleUpdateCategory} 
                  theme={theme} 
                  darkMode={darkMode}
                  creditCardBills={realBalances.creditCardBillsDetailed || []}
                />
                <TransactionTable 
                  transactions={creditCardTransactions} 
                  title="Cartão de Crédito" 
                  formatCurrency={formatCurrency} 
                  formatDate={formatDate} 
                  editingCategory={editingCategory} 
                  setEditingCategory={setEditingCategory} 
                  newCategory={newCategory} 
                  setNewCategory={setNewCategory} 
                  handleUpdateCategory={handleUpdateCategory} 
                  theme={theme} 
                  darkMode={darkMode}
                  creditCardBills={realBalances.creditCardBillsDetailed || []}
                />
              </>
            ) : (
              <TransactionTable 
                transactions={filteredTransactions} 
                title={filters.accountType === 'CREDIT' ? 'Cartão de Crédito' : 'Conta Corrente'} 
                formatCurrency={formatCurrency} 
                formatDate={formatDate}
                editingCategory={editingCategory}
                setEditingCategory={setEditingCategory}
                newCategory={newCategory}
                setNewCategory={setNewCategory}
                handleUpdateCategory={handleUpdateCategory}
                theme={theme}
                darkMode={darkMode}
                creditCardBills={realBalances.creditCardBillsDetailed || []}
              />
            )}
          </div>
        )}

        {/* Loans Tab */}
        {activeTab === 'loans' && (
          <div className="space-y-6">
            {loansData.loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-10 h-10 border-2 border-[#00D4FF]/30 border-t-[#00D4FF] rounded-full animate-spin"></div>
              </div>
            ) : loansData.error ? (
              <div className={clsx("p-4 rounded-lg border", theme.card, theme.cardBorder)}>
                <p className="text-[#FF4757]">Erro: {loansData.error}</p>
              </div>
            ) : (
              <>
                {/* Summary Cards */}
                {loansData.summary && (
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div className={clsx("rounded-2xl p-5 border", theme.card, theme.cardBorder)}>
                      <p className={clsx("text-xs uppercase tracking-wider mb-2", theme.textMuted)}>Total de Empréstimos</p>
                      <p className={clsx("text-2xl font-semibold", theme.text)}>{loansData.summary.total}</p>
                    </div>
                    <div className={clsx("rounded-2xl p-5 border", theme.card, theme.cardBorder)}>
                      <p className={clsx("text-xs uppercase tracking-wider mb-2", theme.textMuted)}>Valor Total</p>
                      <p className={clsx("text-2xl font-semibold", theme.text)}>{formatCurrency(loansData.summary.totalAmount)}</p>
                    </div>
                    <div className={clsx("rounded-2xl p-5 border", theme.card, theme.cardBorder)}>
                      <p className={clsx("text-xs uppercase tracking-wider mb-2", theme.textMuted)}>Total Pago</p>
                      <p className={clsx("text-2xl font-semibold text-[#00FF94]", theme.text)}>{formatCurrency(loansData.summary.totalPaid)}</p>
                    </div>
                    <div className={clsx("rounded-2xl p-5 border", theme.card, theme.cardBorder)}>
                      <p className={clsx("text-xs uppercase tracking-wider mb-2", theme.textMuted)}>Faltante</p>
                      <p className={clsx("text-2xl font-semibold text-[#FF4757]", theme.text)}>{formatCurrency(loansData.summary.totalRemaining)}</p>
                    </div>
                  </div>
                )}

                {/* Header com botão de adicionar */}
                <div className="flex items-center justify-between mb-4">
                  <h2 className={clsx("text-xl font-semibold", theme.text)}>Empréstimos</h2>
                  <button
                    onClick={() => handleOpenLoanModal()}
                    className={clsx(
                      "px-4 py-2 rounded-lg font-medium transition-all",
                      "bg-[#00D4FF] text-white hover:bg-[#00D4FF]/80",
                      "flex items-center gap-2"
                    )}
                  >
                    <span>+</span> Adicionar Empréstimo
                  </button>
                </div>

                {/* Loans List */}
                {loansData.loans.length === 0 ? (
                  <div className={clsx("rounded-2xl p-12 text-center border", theme.card, theme.cardBorder)}>
                    <p className={clsx("text-lg", theme.textMuted)}>Nenhum empréstimo encontrado</p>
                    <button
                      onClick={() => handleOpenLoanModal()}
                      className={clsx(
                        "mt-4 px-4 py-2 rounded-lg font-medium transition-all",
                        "bg-[#00D4FF] text-white hover:bg-[#00D4FF]/80"
                      )}
                    >
                      Adicionar Primeiro Empréstimo
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {loansData.loans.map((loan) => (
                      <div key={loan.id} className={clsx("rounded-2xl p-6 border", theme.card, theme.cardBorder)}>
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <span className={clsx("px-3 py-1 rounded-full text-xs font-medium", 
                                loan.type === 'Consignado' ? "bg-[#00D4FF]/10 text-[#00D4FF]" :
                                loan.type === 'Pessoal' ? "bg-[#7B61FF]/10 text-[#7B61FF]" :
                                loan.type === 'Imobiliário' ? "bg-[#00FF94]/10 text-[#00FF94]" :
                                loan.type === 'Veículo' ? "bg-[#FFB800]/10 text-[#FFB800]" :
                                "bg-[#64748b]/10 text-[#64748b]"
                              )}>
                                {loan.type}
                              </span>
                              {loan.isPaidOff && (
                                <span className="px-3 py-1 rounded-full text-xs font-medium bg-[#00FF94]/20 text-[#00FF94] border border-[#00FF94]/30">
                                  ✓ QUITADO
                                </span>
                              )}
                              {loan.isManual && (
                                <span className="px-3 py-1 rounded-full text-xs font-medium bg-[#7B61FF]/20 text-[#7B61FF] border border-[#7B61FF]/30">
                                  Manual
                                </span>
                              )}
                              <h3 className={clsx("text-lg font-semibold", theme.text)}>{loan.description}</h3>
                            </div>
                            <div className="flex items-center gap-4 text-sm">
                              <span className={clsx(theme.textMuted)}>
                                <strong>Banco:</strong> {loan.bankName}
                              </span>
                              <span className={clsx(theme.textMuted)}>
                                <strong>Pessoa:</strong> {loan.ownerName}
                              </span>
                            </div>
                          </div>
                          <div className="text-right flex flex-col items-end gap-2">
                            <p className={clsx("text-2xl font-bold mb-1", theme.text)}>{formatCurrency(loan.totalAmount)}</p>
                            <p className={clsx("text-xs", theme.textMuted)}>Valor Total</p>
                            <div className="flex gap-2 mt-2">
                              <button
                                onClick={() => handleOpenLoanModal(loan)}
                                className={clsx(
                                  "px-3 py-1 rounded text-xs font-medium transition-all",
                                  "bg-[#7B61FF]/20 text-[#7B61FF] hover:bg-[#7B61FF]/30"
                                )}
                              >
                                Editar
                              </button>
                              {loan.isManual && (
                                <>
                                  <button
                                    onClick={() => handleOpenTransactionModal(loan)}
                                    className={clsx(
                                      "px-3 py-1 rounded text-xs font-medium transition-all",
                                      "bg-[#00FF94]/20 text-[#00FF94] hover:bg-[#00FF94]/30"
                                    )}
                                  >
                                    + Pagamento
                                  </button>
                                  <button
                                    onClick={() => handleDeleteLoan(loan.id)}
                                    className={clsx(
                                      "px-3 py-1 rounded text-xs font-medium transition-all",
                                      "bg-[#FF4757]/20 text-[#FF4757] hover:bg-[#FF4757]/30"
                                    )}
                                  >
                                    Deletar
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="mb-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className={clsx("text-sm", theme.textMuted)}>
                              Parcelas: {loan.paidInstallments} / {loan.totalInstallments}
                            </span>
                            <span className={clsx("text-sm font-medium", theme.text)}>
                              {loan.progress.toFixed(1)}%
                            </span>
                          </div>
                          <div className={clsx("h-2 rounded-full overflow-hidden", darkMode ? "bg-white/5" : "bg-black/5")}>
                            <div 
                              className="h-full bg-gradient-to-r from-[#00D4FF] to-[#7B61FF] transition-all duration-500"
                              style={{ width: `${loan.progress}%` }}
                            ></div>
                          </div>
                        </div>

                        {/* Details Grid */}
                        <div className="grid grid-cols-3 gap-4 pt-4 border-t" style={{ borderColor: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}>
                          <div>
                            <p className={clsx("text-xs uppercase tracking-wider mb-1", theme.textMuted)}>Total Pago</p>
                            <p className={clsx("text-lg font-semibold text-[#00FF94]", theme.text)}>{formatCurrency(loan.totalPaid)}</p>
                          </div>
                          <div>
                            <p className={clsx("text-xs uppercase tracking-wider mb-1", theme.textMuted)}>Faltante</p>
                            <p className={clsx("text-lg font-semibold", loan.isPaidOff ? "text-[#00FF94]" : "text-[#FF4757]", theme.text)}>
                              {loan.isPaidOff ? "R$ 0,00" : formatCurrency(loan.remainingAmount)}
                            </p>
                          </div>
                          <div>
                            <p className={clsx("text-xs uppercase tracking-wider mb-1", theme.textMuted)}>Parcelas Restantes</p>
                            <p className={clsx("text-lg font-semibold", theme.text)}>{loan.totalInstallments - loan.paidInstallments}</p>
                          </div>
                        </div>

                        {/* Transactions List (Collapsible) */}
                        {loan.transactions && loan.transactions.length > 0 && (
                          <details className="mt-4 pt-4 border-t" style={{ borderColor: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}>
                            <summary className={clsx("cursor-pointer text-sm font-medium mb-3 list-none flex items-center justify-between", theme.text, "hover:opacity-70 transition-opacity")}>
                              <span>Transações de Pagamento ({loan.transactions.length})</span>
                              <span className="text-xs">▼</span>
                            </summary>
                            <div className="mt-3 space-y-2">
                              {loan.transactions.map((tx) => (
                                <div key={tx.id} className={clsx("flex items-center justify-between p-3 rounded-lg", darkMode ? "bg-white/5" : "bg-black/5")}>
                                  <div className="flex-1">
                                    <p className={clsx("text-sm font-medium", theme.text)}>{tx.description || `Parcela ${tx.installment_number || ''}`}</p>
                                    <p className={clsx("text-xs", theme.textMuted)}>{formatDate(tx.date)}</p>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <p className={clsx("text-sm font-semibold text-[#00FF94]", theme.text)}>{formatCurrency(tx.amount)}</p>
                                    {loan.isManual && (
                                      <button
                                        onClick={() => handleDeleteTransaction(loan.id, tx.id)}
                                        className={clsx(
                                          "px-2 py-1 rounded text-xs font-medium transition-all",
                                          "bg-[#FF4757]/20 text-[#FF4757] hover:bg-[#FF4757]/30"
                                        )}
                                      >
                                        ✕
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </details>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Goals Tab */}
        {activeTab === 'limits' && (
          <div className="space-y-6">
            {goalsData.loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-10 h-10 border-2 border-[#00D4FF]/30 border-t-[#00D4FF] rounded-full animate-spin"></div>
              </div>
            ) : goalsData.error ? (
              <div className={clsx("p-4 rounded-lg border", theme.card, theme.cardBorder)}>
                <p className="text-[#FF4757]">Erro: {goalsData.error}</p>
              </div>
            ) : (
              <>
                {/* Header com botão de adicionar */}
                <div className="flex items-center justify-between mb-4">
                  <h2 className={clsx("text-xl font-semibold", theme.text)}>Limites de Gastos</h2>
                  <button
                    onClick={() => handleOpenGoalModal()}
                    className={clsx(
                      "px-4 py-2 rounded-lg font-medium transition-all",
                      "bg-[#FFB800] text-white hover:bg-[#FFB800]/80",
                      "flex items-center gap-2"
                    )}
                  >
                    <span>+</span> Adicionar Limite
                  </button>
                </div>

                {/* Goals List */}
                {goalsData.goals.length === 0 ? (
                  <div className={clsx("rounded-2xl p-12 text-center border", theme.card, theme.cardBorder)}>
                    <p className={clsx("text-lg", theme.textMuted)}>Nenhum limite encontrado</p>
                    <button
                      onClick={() => handleOpenGoalModal()}
                      className={clsx(
                        "mt-4 px-4 py-2 rounded-lg font-medium transition-all",
                        "bg-[#FFB800] text-white hover:bg-[#FFB800]/80"
                      )}
                    >
                      Adicionar Primeiro Limite
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {goalsData.goals.map((goal) => {
                      // Filtrar transações relacionadas a este limite (por categoria)
                      let relatedTransactions = [];
                      if (dashboardData?.transactions && goal.category) {
                        // Calcular período: início e fim do mês
                        const periodStart = new Date(goal.periodYear, goal.periodMonth - 1, 1);
                        periodStart.setHours(0, 0, 0, 0);
                        const periodEnd = new Date(goal.periodYear, goal.periodMonth, 0, 23, 59, 59);
                        
                        relatedTransactions = dashboardData.transactions.filter(tx => {
                          // Filtrar por categoria
                          if (tx.category !== goal.category) return false;
                          
                          // Filtrar por período
                          const txDate = new Date(tx.date);
                          if (txDate < periodStart || txDate > periodEnd) return false;
                          
                          // Apenas gastos (valores negativos)
                          return tx.amount < 0;
                        }).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10); // Últimas 10 transações
                      }
                      
                      return (
                      <div key={goal.id} className={clsx("rounded-2xl p-6 border relative overflow-hidden", theme.card, theme.cardBorder, "hover:scale-[1.02] transition-transform duration-200")}>
                        {/* Background gradient effect */}
                        <div className={clsx(
                          "absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-10 -z-0",
                          goal.isOverBudget ? "bg-[#FF4757]" : goal.progress >= 100 ? "bg-[#00FF94]" : "bg-[#FFB800]"
                        )}></div>
                        
                        <div className="relative z-10">
                          {/* Header */}
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-3">
                                {goal.isOverBudget ? (
                                  <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-[#FF4757]/20 text-[#FF4757] border border-[#FF4757]/40 flex items-center gap-1.5">
                                    <span>▲</span> ACIMA DO ORÇAMENTO
                                  </span>
                                ) : goal.progress >= 100 ? (
                                  <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-[#00FF94]/20 text-[#00FF94] border border-[#00FF94]/40 flex items-center gap-1.5">
                                    <span>✓</span> META ATINGIDA
                                  </span>
                                ) : (
                                  <span className={clsx("px-3 py-1.5 rounded-full text-xs font-medium", darkMode ? "bg-white/5 text-white/70" : "bg-black/5 text-black/70")}>
                                    Em andamento
                                  </span>
                                )}
                              </div>
                              <h3 className={clsx("text-xl font-bold mb-1", theme.text)}>{goal.name}</h3>
                              <p className={clsx("text-xs font-medium", theme.textMuted)}>
                                {goal.periodLabel || `${goal.periodMonth}/${goal.periodYear}`}
                              </p>
                            </div>
                            <div className="flex gap-1.5">
                              <button
                                onClick={() => handleOpenGoalModal(goal)}
                                className={clsx(
                                  "px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all",
                                  "bg-[#7B61FF]/20 text-[#7B61FF] hover:bg-[#7B61FF]/30 border border-[#7B61FF]/30"
                                )}
                                title="Editar"
                              >
                                ✎
                              </button>
                              <button
                                onClick={() => handleDeleteGoal(goal.id)}
                                className={clsx(
                                  "px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all",
                                  "bg-[#FF4757]/20 text-[#FF4757] hover:bg-[#FF4757]/30 border border-[#FF4757]/30"
                                )}
                                title="Deletar"
                              >
                                ✕
                              </button>
                            </div>
                          </div>

                          {/* Amount Display */}
                          <div className="mb-4">
                            <div className="flex items-baseline gap-2 mb-1">
                              <span className={clsx("text-2xl font-bold", goal.isOverBudget ? "text-[#FF4757]" : "text-[#00FF94]", theme.text)}>
                                {formatCurrency(goal.currentAmount)}
                              </span>
                              <span className={clsx("text-sm", theme.textMuted)}>
                                / {formatCurrency(goal.targetAmount)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className={clsx("text-xs font-medium", theme.textMuted)}>
                                {goal.progress.toFixed(1)}% do orçamento
                              </span>
                              {goal.isOverBudget && (
                                <span className="text-xs font-bold text-[#FF4757]">
                                  +{formatCurrency(goal.overBudgetAmount)} acima
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Progress Bar */}
                          <div className="mb-4">
                            <div className={clsx("h-4 rounded-full overflow-hidden relative", darkMode ? "bg-white/10" : "bg-black/10")}>
                              <div 
                                className={clsx(
                                  "h-full transition-all duration-500 rounded-full",
                                  goal.isOverBudget ? "bg-gradient-to-r from-[#FF4757] to-[#FF6B7A]" : 
                                  goal.progress >= 100 ? "bg-gradient-to-r from-[#00FF94] to-[#00D4AA]" : 
                                  "bg-gradient-to-r from-[#FFB800] via-[#FF9500] to-[#FF6B00]"
                                )}
                                style={{ width: `${Math.min(100, Math.max(0, goal.progress))}%` }}
                              ></div>
                              {goal.progress > 100 && (
                                <div 
                                  className="absolute top-0 left-0 h-full w-full bg-gradient-to-r from-[#FF4757] to-[#FF6B7A] opacity-50 rounded-full"
                                  style={{ width: `${Math.min(100, ((goal.progress - 100) / goal.progress) * 100)}%` }}
                                ></div>
                              )}
                            </div>
                          </div>

                          {/* Details Grid */}
                          <div className="grid grid-cols-2 gap-3 pt-4 border-t" style={{ borderColor: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}>
                            <div>
                              <p className={clsx("text-xs font-medium mb-1", theme.textMuted)}>Valor Teto</p>
                              <p className={clsx("text-sm font-semibold", theme.text)}>
                                {formatCurrency(goal.targetAmount)}
                              </p>
                            </div>
                            {goal.isOverBudget ? (
                              <div>
                                <p className={clsx("text-xs font-medium mb-1", theme.textMuted)}>Excedente</p>
                                <p className="text-sm font-semibold text-[#FF4757]">
                                  +{formatCurrency(goal.overBudgetAmount)}
                                </p>
                              </div>
                            ) : (
                              <div>
                                <p className={clsx("text-xs font-medium mb-1", theme.textMuted)}>Disponível</p>
                                <p className="text-sm font-semibold text-[#00FF94]">
                                  {formatCurrency(goal.remaining)}
                                </p>
                              </div>
                            )}
                          </div>

                          {/* Transações usando details/summary (igual Gastos Previstos) */}
                          {relatedTransactions.length > 0 && (
                            <details className="relative z-10 mt-2">
                              <summary className={clsx(
                                "cursor-pointer text-xs font-medium py-1.5 px-2 rounded transition-all",
                                darkMode ? "bg-white/5 hover:bg-white/10" : "bg-black/5 hover:bg-black/10",
                                theme.textMuted,
                                "list-none flex items-center justify-between"
                              )}>
                                <span>Transações ({relatedTransactions.length})</span>
                                <span className="text-xs ml-1">▼</span>
                              </summary>
                              <div className="mt-2 space-y-1.5 max-h-64 overflow-y-auto">
                                {relatedTransactions.map((tx) => (
                                  <div 
                                    key={tx.id} 
                                    className={clsx(
                                      "p-2 rounded",
                                      darkMode ? "bg-white/5" : "bg-black/5"
                                    )}
                                  >
                                    <div className="flex justify-between items-start mb-0.5">
                                      <span className={clsx("text-xs font-medium", theme.text)}>{formatDate(tx.date)}</span>
                                      <span className={clsx("text-xs font-semibold", theme.text)}>{formatCurrency(Math.abs(tx.amount))}</span>
                                    </div>
                                    <p className={clsx("text-xs truncate", theme.textMuted)}>{tx.description || 'Sem descrição'}</p>
                                    {tx.category && (
                                      <span className={clsx("text-[9px]", theme.textMuted)}>{tx.category}</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </details>
                          )}
                        </div>
                      </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Gastos Previstos Tab */}
        {activeTab === 'expected-expenses' && (
          <div className="space-y-6">
            {expectedExpensesData.loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-10 h-10 border-2 border-[#00D4FF]/30 border-t-[#00D4FF] rounded-full animate-spin"></div>
              </div>
            ) : expectedExpensesData.error ? (
              <div className={clsx("p-4 rounded-lg border", theme.card, theme.cardBorder)}>
                <p className="text-[#FF4757]">Erro: {expectedExpensesData.error}</p>
              </div>
            ) : (
              <>
                {/* Header com card de valor total */}
                <div className="flex items-center justify-between mb-4 gap-4">
                  <div className="flex items-center gap-3">
                    <h2 className={clsx("text-xl font-semibold", theme.text)}>Gastos Previstos</h2>
                    {/* Botão Adicionar Gasto - menor, ao lado do título */}
                    <button
                      onClick={() => handleOpenExpectedExpenseModal()}
                      className={clsx(
                        "px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                        "bg-[#00D4FF] text-white hover:bg-[#00D4FF]/80",
                        "flex items-center gap-1.5"
                      )}
                    >
                      <span>+</span> Adicionar Gasto
                    </button>
                  </div>
                  {/* Card Total Previsto e Total Pago - menor, no canto direito */}
                  {expectedExpensesData.expenses.length > 0 && (
                    <div className={clsx(
                      "rounded-2xl p-3 border transition-all duration-300",
                      theme.card,
                      theme.cardBorder,
                      "min-w-[160px]"
                    )}>
                      {/* Total Previsto */}
                      <div className="mb-3">
                        <h3 className={clsx("text-[10px] font-medium uppercase tracking-wider mb-1", darkMode ? "text-white/80" : "text-black/80")}>
                          Total Previsto
                        </h3>
                        <p className={clsx("text-lg font-bold", theme.text)}>
                          {formatCurrency(
                            expectedExpensesData.expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0)
                          )}
                        </p>
                      </div>
                      
                      {/* Total Pago */}
                      <div>
                        <h3 className={clsx("text-[10px] font-medium uppercase tracking-wider mb-1", darkMode ? "text-white/80" : "text-black/80")}>
                          Total Pago
                        </h3>
                        <p className={clsx("text-lg font-bold", theme.text)}>
                          {formatCurrency(
                            expectedExpensesData.expenses.reduce((sum, exp) => {
                              // Calcular total pago a partir das transações encontradas
                              const totalPaid = exp.matchingTransactions && exp.matchingTransactions.length > 0
                                ? exp.matchingTransactions.reduce((txSum, tx) => txSum + Math.abs(tx.amount), 0)
                                : (exp.totalPaid || 0);
                              return sum + totalPaid;
                            }, 0)
                          )}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Expenses List */}
                {expectedExpensesData.expenses.length === 0 ? (
                  <div className={clsx("rounded-2xl p-12 text-center border", theme.card, theme.cardBorder)}>
                    <p className={clsx("text-lg", theme.textMuted)}>Nenhum gasto previsto encontrado</p>
                    <button
                      onClick={() => handleOpenExpectedExpenseModal()}
                      className={clsx(
                        "mt-4 px-4 py-2 rounded-lg font-medium transition-all",
                        "bg-[#00D4FF] text-white hover:bg-[#00D4FF]/80"
                      )}
                    >
                      Adicionar Primeiro Gasto
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    {expectedExpensesData.expenses.map((expense) => (
                      <div key={expense.id} className={clsx("rounded-lg p-3 border relative overflow-hidden", theme.card, theme.cardBorder, "hover:scale-[1.01] transition-transform duration-200")}>
                        {/* Background gradient effect */}
                        <div className={clsx(
                          "absolute top-0 right-0 w-16 h-16 rounded-full blur-2xl opacity-10 -z-0",
                          expense.isPaid ? "bg-[#00FF94]" : expense.isActive ? "bg-[#FFB800]" : "bg-[#64748b]"
                        )}></div>

                        {/* Header */}
                        <div className="relative z-10 flex items-start justify-between mb-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-1.5">
                              {expense.isPaid ? (
                                <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-[#00FF94]/20 text-[#00FF94] border border-[#00FF94]/40 flex items-center gap-0.5">
                                  <span>✓</span> PAGO
                                </span>
                              ) : expense.isActive ? (
                                <span className="px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-[#FFB800]/20 text-[#FFB800] border border-[#FFB800]/40 flex items-center gap-0.5">
                                  <span>⏳</span> PENDENTE
                                </span>
                              ) : (
                                <span className={clsx("px-1.5 py-0.5 rounded-full text-[9px] font-medium", darkMode ? "bg-white/5 text-white/70" : "bg-black/5 text-black/70")}>
                                  Encerrado
                                </span>
                              )}
                            </div>
                            <h3 className={clsx("text-base font-bold mb-0.5 truncate", theme.text)}>{expense.name}</h3>
                            <p className={clsx("text-[9px] font-medium truncate", theme.textMuted)}>
                              {expense.paymentMethod}
                            </p>
                          </div>
                          <div className="flex gap-0.5 ml-1">
                            <button
                              onClick={() => handleMarkAsPaid(expense.id, expense.isPaid)}
                              className={clsx(
                                "px-1.5 py-0.5 rounded text-[9px] font-medium transition-all",
                                expense.isPaid 
                                  ? "bg-[#00FF94]/20 text-[#00FF94] hover:bg-[#00FF94]/30 border border-[#00FF94]/30"
                                  : "bg-[#64748b]/20 text-[#64748b] hover:bg-[#64748b]/30 border border-[#64748b]/30"
                              )}
                              title={expense.isPaid ? "Marcar como não pago" : "Marcar como pago"}
                            >
                              {expense.isPaid ? "✓" : "○"}
                            </button>
                            <button
                              onClick={() => handleOpenExpectedExpenseModal(expense)}
                              className={clsx(
                                "px-1.5 py-0.5 rounded text-[9px] font-medium transition-all",
                                "bg-[#7B61FF]/20 text-[#7B61FF] hover:bg-[#7B61FF]/30 border border-[#7B61FF]/30"
                              )}
                              title="Editar"
                            >
                              ✎
                            </button>
                            <button
                              onClick={() => handleDeleteExpectedExpense(expense.id)}
                              className={clsx(
                                "px-1.5 py-0.5 rounded text-[9px] font-medium transition-all",
                                "bg-[#FF4757]/20 text-[#FF4757] hover:bg-[#FF4757]/30 border border-[#FF4757]/30"
                              )}
                              title="Deletar"
                            >
                              ✕
                            </button>
                          </div>
                        </div>

                        {/* Amount Display */}
                        <div className="mb-2 relative z-10">
                          <div className="flex flex-col gap-1 mb-1">
                            <div className="flex items-baseline gap-1.5">
                              <span className={clsx("text-sm font-bold", expense.isPaid ? "text-[#00FF94]" : "text-[#FFB800]", theme.text)}>
                                {formatCurrency(expense.amount)}
                              </span>
                              <span className={clsx("text-[9px] font-medium", theme.textMuted)}>
                                Previsto
                              </span>
                            </div>
                            
                            {/* Valor Pago - sempre calcular a partir das transações encontradas */}
                            {(() => {
                              // SEMPRE calcular total pago a partir das transações encontradas
                              const calculatedTotal = expense.matchingTransactions && expense.matchingTransactions.length > 0
                                ? expense.matchingTransactions.reduce((sum, tx) => sum + Math.abs(tx.amount), 0)
                                : 0;
                              
                              // Mostrar sempre, mesmo que seja 0 (para indicar que não foi pago ainda)
                              return (
                                <div className="flex items-baseline gap-1.5">
                                  <span className={clsx(
                                    "text-sm font-bold",
                                    calculatedTotal >= expense.amount ? "text-[#00FF94]" : calculatedTotal > 0 ? "text-[#FFB800]" : "text-gray-500"
                                  )}>
                                    {formatCurrency(calculatedTotal)}
                                  </span>
                                  <span className={clsx("text-[9px] font-medium", theme.textMuted)}>
                                    Pago
                                  </span>
                                  {calculatedTotal > 0 && expense.amount > 0 && (
                                    <span className={clsx("text-[9px] font-medium", calculatedTotal >= expense.amount ? "text-[#00FF94]" : "text-[#FFB800]")}>
                                      ({((calculatedTotal / expense.amount) * 100).toFixed(0)}%)
                                    </span>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                          <div className="flex items-center justify-between mt-1">
                            <span className={clsx("text-[9px] font-medium truncate", theme.textMuted)}>
                              {expense.endDateLabel}
                            </span>
                            {expense.isPaidManually && (
                              <span className={clsx("text-[9px] font-medium text-[#00FF94]")}>
                                Manual
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Payment Info */}
                        {expense.isPaid && expense.lastPaymentDate && (
                          <div className="mb-2 pt-2 border-t" style={{ borderColor: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}>
                            <p className={clsx("text-[9px] font-medium mb-0.5", theme.textMuted)}>Último pagamento</p>
                            <p className={clsx("text-[10px] font-semibold", theme.text)}>
                              {formatDate(expense.lastPaymentDate)} - {formatCurrency(expense.lastPaymentAmount)}
                            </p>
                          </div>
                        )}

                        {/* Matching Transactions */}
                        {expense.matchingTransactions && expense.matchingTransactions.length > 0 && (
                          <details className="relative z-10 mt-2">
                            <summary className={clsx(
                              "cursor-pointer text-[9px] font-medium py-1 px-1.5 rounded transition-all",
                              darkMode ? "bg-white/5 hover:bg-white/10" : "bg-black/5 hover:bg-black/10",
                              theme.textMuted
                            )}>
                              <span>Transações ({expense.matchingTransactions.length})</span>
                              <span className="text-[9px] ml-1">▼</span>
                            </summary>
                            <div className="mt-1 space-y-1 max-h-32 overflow-y-auto">
                              {expense.matchingTransactions.map((tx) => (
                                <div key={tx.id} className={clsx("p-1 rounded text-[9px]", darkMode ? "bg-white/5" : "bg-black/5")}>
                                  <div className="flex justify-between items-start mb-0.5">
                                    <span className={clsx("font-medium", theme.text)}>{formatDate(tx.date)}</span>
                                    <span className={clsx("font-semibold", theme.text)}>{formatCurrency(Math.abs(tx.amount))}</span>
                                  </div>
                                  <p className={clsx("text-[9px] truncate", theme.textMuted)}>{tx.description}</p>
                                  <div className="flex gap-1 mt-0.5">
                                    <span className={clsx("text-[9px]", theme.textMuted)}>{tx.category}</span>
                                    {tx.bankName && <span className={clsx("text-[9px]", theme.textMuted)}>• {tx.bankName}</span>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </details>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Financial Goals Tab (Novas Metas) */}
        {activeTab === 'goals' && (
          <div className="space-y-6">
            {financialGoalsData.loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-10 h-10 border-2 border-[#00D4FF]/30 border-t-[#00D4FF] rounded-full animate-spin"></div>
              </div>
            ) : financialGoalsData.error ? (
              <div className={clsx("p-4 rounded-lg border", theme.card, theme.cardBorder)}>
                <p className="text-[#FF4757]">Erro: {financialGoalsData.error}</p>
              </div>
            ) : (
              <>
                {/* Header com botão de adicionar */}
                <div className="flex items-center justify-between mb-4">
                  <h2 className={clsx("text-xl font-semibold", theme.text)}>Metas Financeiras</h2>
                  <button
                    onClick={() => handleOpenFinancialGoalModal()}
                    className={clsx(
                      "px-4 py-2 rounded-lg font-medium transition-all",
                      "bg-[#00D4FF] text-white hover:bg-[#00D4FF]/80",
                      "flex items-center gap-2"
                    )}
                  >
                    <span>+</span> Adicionar Meta
                  </button>
                </div>

                {/* Goals List */}
                {financialGoalsData.goals.length === 0 ? (
                  <div className={clsx("rounded-2xl p-12 text-center border", theme.card, theme.cardBorder)}>
                    <p className={clsx("text-lg", theme.textMuted)}>Nenhuma meta encontrada</p>
                    <p className={clsx("text-sm mt-2", theme.textMuted)}>Crie metas como reserva de emergência, compras planejadas, etc.</p>
                    <button
                      onClick={() => handleOpenFinancialGoalModal()}
                      className={clsx(
                        "mt-4 px-4 py-2 rounded-lg font-medium transition-all",
                        "bg-[#00D4FF] text-white hover:bg-[#00D4FF]/80"
                      )}
                    >
                      Adicionar Primeira Meta
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {financialGoalsData.goals.map((goal) => (
                      <div key={goal.id} className={clsx("rounded-2xl p-6 border relative overflow-hidden", theme.card, theme.cardBorder, "hover:scale-[1.02] transition-transform duration-200")}>
                        {/* Background gradient effect */}
                        <div className={clsx(
                          "absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-10 -z-0",
                          goal.isCompleted ? "bg-[#00FF94]" : "bg-[#00D4FF]"
                        )}></div>
                        
                        <div className="relative z-10">
                          {/* Header */}
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-3">
                                {goal.type === 'emergency_fund' && (
                                  <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-[#00D4FF]/20 text-[#00D4FF] border border-[#00D4FF]/40">
                                    🛡️ Reserva de Emergência
                                  </span>
                                )}
                                {goal.isCompleted ? (
                                  <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-[#00FF94]/20 text-[#00FF94] border border-[#00FF94]/40 flex items-center gap-1.5">
                                    <span>✓</span> META ATINGIDA
                                  </span>
                                ) : (
                                  <span className={clsx("px-3 py-1.5 rounded-full text-xs font-medium", darkMode ? "bg-white/5 text-white/70" : "bg-black/5 text-black/70")}>
                                    Em andamento
                                  </span>
                                )}
                              </div>
                              <h3 className={clsx("text-xl font-bold mb-1", theme.text)}>{goal.name}</h3>
                              {goal.description && (
                                <p className={clsx("text-xs", theme.textMuted)}>{goal.description}</p>
                              )}
                              {goal.target_date && (
                                <p className={clsx("text-xs font-medium mt-1", theme.textMuted)}>
                                  Meta: {DateTime.fromISO(goal.target_date).toLocaleString(DateTime.DATE_MED)}
                                </p>
                              )}
                            </div>
                            <div className="flex gap-1.5">
                              <button
                                onClick={() => handleOpenFinancialGoalModal(goal)}
                                className={clsx(
                                  "px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all",
                                  "bg-[#7B61FF]/20 text-[#7B61FF] hover:bg-[#7B61FF]/30 border border-[#7B61FF]/30"
                                )}
                                title="Editar"
                              >
                                ✎
                              </button>
                              <button
                                onClick={() => handleDeleteFinancialGoal(goal.id)}
                                className={clsx(
                                  "px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all",
                                  "bg-[#FF4757]/20 text-[#FF4757] hover:bg-[#FF4757]/30 border border-[#FF4757]/30"
                                )}
                                title="Deletar"
                              >
                                ✕
                              </button>
                            </div>
                          </div>

                          {/* Amount Display */}
                          <div className="mb-4">
                            <div className="flex items-baseline gap-2 mb-1">
                              <span className={clsx("text-2xl font-bold", goal.isCompleted ? "text-[#00FF94]" : "text-[#00D4FF]", theme.text)}>
                                {formatCurrency(goal.current_amount)}
                              </span>
                              <span className={clsx("text-sm", theme.textMuted)}>
                                / {formatCurrency(goal.target_amount)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className={clsx("text-xs font-medium", theme.textMuted)}>
                                {goal.progress.toFixed(1)}% concluído
                              </span>
                              {!goal.isCompleted && (
                                <span className="text-xs font-bold text-[#00D4FF]">
                                  Faltam {formatCurrency(goal.remaining)}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Progress Bar */}
                          <div className="mb-4">
                            <div className={clsx("h-4 rounded-full overflow-hidden relative", darkMode ? "bg-white/10" : "bg-black/10")}>
                              <div 
                                className={clsx(
                                  "h-full transition-all duration-500 rounded-full",
                                  goal.isCompleted 
                                    ? "bg-gradient-to-r from-[#00FF94] to-[#00D4AA]" 
                                    : "bg-gradient-to-r from-[#00D4FF] to-[#7B61FF]"
                                )}
                                style={{ width: `${Math.min(100, Math.max(0, goal.progress))}%` }}
                              ></div>
                            </div>
                          </div>

                          {/* Details Grid */}
                          <div className="grid grid-cols-2 gap-3 pt-4 border-t" style={{ borderColor: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}>
                            <div>
                              <p className={clsx("text-xs font-medium mb-1", theme.textMuted)}>Valor Alvo</p>
                              <p className={clsx("text-sm font-semibold", theme.text)}>
                                {formatCurrency(goal.target_amount)}
                              </p>
                            </div>
                            {goal.isCompleted ? (
                              <div>
                                <p className={clsx("text-xs font-medium mb-1", theme.textMuted)}>Status</p>
                                <p className="text-sm font-semibold text-[#00FF94]">
                                  Concluída ✓
                                </p>
                              </div>
                            ) : (
                              <div>
                                <p className={clsx("text-xs font-medium mb-1", theme.textMuted)}>Faltam</p>
                                <p className="text-sm font-semibold text-[#00D4FF]">
                                  {formatCurrency(goal.remaining)}
                                </p>
                              </div>
                            )}
                          </div>

                          {/* Valor mensal necessário (para todas as metas com data) */}
                          {goal.target_date && !goal.isCompleted && (() => {
                            const remaining = goal.target_amount - goal.current_amount;
                            const targetDate = new Date(goal.target_date);
                            const now = new Date();
                            const daysRemaining = Math.max(1, Math.ceil((targetDate - now) / (1000 * 60 * 60 * 24)));
                            const monthsRemaining = Math.max(1, daysRemaining / 30);
                            const monthlyAmount = remaining > 0 ? remaining / monthsRemaining : 0;
                            
                            return (
                              <div className={clsx("mt-4 p-3 rounded-lg border", "bg-[#00D4FF]/10 border-[#00D4FF]/30")}>
                                <p className={clsx("text-xs font-medium mb-1 text-[#00D4FF]")}>💰 Valor Mensal Necessário</p>
                                <p className={clsx("text-sm font-semibold text-[#00D4FF]")}>
                                  {formatCurrency(monthlyAmount)}/mês
                                </p>
                                <p className={clsx("text-xs mt-1", theme.textMuted)}>
                                  Para atingir a meta até {DateTime.fromISO(goal.target_date).toLocaleString(DateTime.DATE_MED)}
                                </p>
                                {goal.tag && (
                                  <p className={clsx("text-xs mt-1", theme.textMuted)}>
                                    💡 Categorize transações de ENTRADA (valores positivos) com a tag "{goal.tag}" para atualizar automaticamente
                                  </p>
                                )}
                              </div>
                            );
                          })()}

                          {/* Sugestão de valor mensal para Reserva de Emergência */}
                          {goal.type === 'emergency_fund' && goal.suggested_monthly_amount && !goal.isCompleted && !goal.target_date && (
                            <div className={clsx("mt-4 p-3 rounded-lg border", "bg-[#00D4FF]/10 border-[#00D4FF]/30")}>
                              <p className={clsx("text-xs font-medium mb-1 text-[#00D4FF]")}>💡 Sugestão Mensal</p>
                              <p className={clsx("text-sm font-semibold text-[#00D4FF]")}>
                                {formatCurrency(goal.suggested_monthly_amount)}/mês
                              </p>
                              <p className={clsx("text-xs mt-1", theme.textMuted)}>
                                Para atingir a meta em 12 meses
                              </p>
                            </div>
                          )}

                          {/* Mostrar tag se houver */}
                          {goal.tag && (
                            <div className={clsx("mt-3 pt-3 border-t", "border-white/5")}>
                              <p className={clsx("text-xs font-medium mb-1", theme.textMuted)}>Tag/Categoria</p>
                              <span className={clsx("inline-block px-2 py-1 rounded text-xs font-medium", darkMode ? "bg-[#7B61FF]/20 text-[#7B61FF]" : "bg-[#7B61FF]/10 text-[#7B61FF]")}>
                                {goal.tag}
                              </span>
                              <p className={clsx("text-xs mt-1", theme.textMuted)}>
                                Valor atual calculado automaticamente das transações com esta tag
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === 'calendar' && (
          <div className="space-y-6">
            {dueDatesData.loading ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#00D4FF]"></div>
                <p className={clsx("mt-4", theme.textMuted)}>Carregando vencimentos...</p>
              </div>
            ) : dueDatesData.error ? (
              <div className={clsx("p-4 rounded-lg border", theme.card, theme.border)}>
                <p className={clsx("text-red-400")}>Erro: {dueDatesData.error}</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-semibold">Calendário de Vencimentos</h2>
                  <button
                    onClick={() => handleOpenDueDateModal()}
                    className={clsx(
                      "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                      "bg-gradient-to-r from-[#00D4FF] to-[#7B61FF] text-white hover:opacity-90"
                    )}
                  >
                    + Adicionar Vencimento
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => {
                    // Buscar itens tanto com chave numérica quanto string
                    const dayItems = dueDatesData.calendar[day] || dueDatesData.calendar[String(day)] || [];
                    const now = new Date();
                    const isPast = day < now.getDate();
                    const isToday = day === now.getDate();

                    return (
                      <div
                        key={day}
                        className={clsx(
                          "p-3 rounded-lg border min-h-[120px]",
                          theme.card,
                          theme.border,
                          isToday && "ring-2 ring-[#00D4FF]",
                          isPast && "opacity-60"
                        )}
                      >
                        <div className={clsx(
                          "text-sm font-semibold mb-2",
                          isToday ? "text-[#00D4FF]" : theme.text
                        )}>
                          Dia {day}
                        </div>
                        <div className="space-y-1">
                          {dayItems.length === 0 ? (
                            <p className={clsx("text-xs", theme.textMuted)}>Sem vencimentos</p>
                          ) : (
                            dayItems.map((item) => (
                              <div
                                key={`${item.source_type || 'custom'}-${item.id}`}
                                className={clsx(
                                  "text-xs p-1.5 rounded border relative group",
                                  theme.card,
                                  theme.border
                                )}
                              >
                                <div className="flex items-start justify-between gap-1">
                                  <div className="flex-1 min-w-0">
                                    <div className={clsx("font-medium", theme.text)}>{item.name}</div>
                                    {item.amount && (
                                      <div className={clsx("text-[#00D4FF] mt-0.5")}>
                                        {formatCurrency(item.amount)}
                                      </div>
                                    )}
                                  </div>
                                  {item.source_type === 'custom' || !item.source_type ? (
                                    <button
                                      onClick={() => handleDeleteDueDate(item.id)}
                                      className={clsx(
                                        "opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-red-500/20 text-red-400 flex-shrink-0"
                                      )}
                                      title="Remover"
                                    >
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                      </svg>
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {dashboardData && activeTab === 'analytics' && (
          <div className="space-y-6">
            {/* Cards de Métricas Principais */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className={clsx("rounded-2xl p-6 border relative overflow-hidden", theme.card, theme.cardBorder)}>
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#00D4FF]/10 rounded-full blur-3xl -z-0"></div>
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs text-[#00D4FF] uppercase tracking-wider font-medium">Entradas</h3>
                    <div className="w-8 h-8 rounded-lg bg-[#00D4FF]/20 flex items-center justify-center">
                      <svg className="w-4 h-4 text-[#00D4FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                    </div>
                  </div>
                  <p className={clsx("text-3xl font-bold mb-1", theme.text)}>{formatCurrency(periodIncome)}</p>
                  <p className={clsx("text-xs", theme.textMuted)}>Período atual</p>
                </div>
              </div>

              <div className={clsx("rounded-2xl p-6 border relative overflow-hidden", theme.card, theme.cardBorder)}>
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#FF4757]/10 rounded-full blur-3xl -z-0"></div>
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs text-[#FF4757] uppercase tracking-wider font-medium">Gastos</h3>
                    <div className="w-8 h-8 rounded-lg bg-[#FF4757]/20 flex items-center justify-center">
                      <svg className="w-4 h-4 text-[#FF4757]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                      </svg>
                    </div>
                  </div>
                  <p className={clsx("text-3xl font-bold mb-1", theme.text)}>{formatCurrency(periodExpenses)}</p>
                  <p className={clsx("text-xs", theme.textMuted)}>Período atual</p>
                </div>
              </div>

              <div className={clsx("rounded-2xl p-6 border relative overflow-hidden", theme.card, theme.cardBorder)}>
                <div className={clsx("absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl -z-0", periodMovement >= 0 ? "bg-[#00FF94]/10" : "bg-[#FF4757]/10")}></div>
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className={clsx("text-xs uppercase tracking-wider font-medium", periodMovement >= 0 ? "text-[#00FF94]" : "text-[#FF4757]")}>Balanço</h3>
                    <div className={clsx("w-8 h-8 rounded-lg flex items-center justify-center", periodMovement >= 0 ? "bg-[#00FF94]/20" : "bg-[#FF4757]/20")}>
                      {periodMovement >= 0 ? (
                        <svg className="w-4 h-4 text-[#00FF94]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 text-[#FF4757]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )}
                    </div>
                  </div>
                  <p className={clsx(
                    "text-3xl font-bold mb-1",
                    periodMovement >= 0 ? "text-[#00FF94]" : "text-[#FF4757]"
                  )}>
                    {formatCurrency(periodMovement)}
                  </p>
                  <p className={clsx("text-xs", theme.textMuted)}>
                    {periodIncome > 0 ? `${((periodMovement / periodIncome) * 100).toFixed(1)}% da renda` : 'Sem renda'}
                  </p>
                </div>
              </div>
            </div>

            {/* Gráfico de Pizza - Distribuição por Categoria */}
            <div className={clsx("rounded-2xl p-6 border", theme.card, theme.cardBorder)}>
              <h3 className={clsx("text-lg font-semibold mb-6", theme.text)}>Distribuição de Gastos</h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="h-64 flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={dashboardData.categoryTotals.slice(0, 8).map((cat, idx) => ({
                          name: cat.category,
                          value: cat.total,
                          color: CHART_COLORS[idx % CHART_COLORS.length]
                        }))}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {dashboardData.categoryTotals.slice(0, 8).map((cat, idx) => (
                          <Cell key={`cell-${idx}`} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value) => formatCurrency(value)}
                        contentStyle={{
                          backgroundColor: darkMode ? '#1a1a2e' : '#ffffff',
                          border: `1px solid ${darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                          borderRadius: '8px',
                          color: darkMode ? '#ffffff' : '#000000'
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {dashboardData.categoryTotals.slice(0, 8).map((cat, idx) => {
                    const percentage = dashboardData.categoryTotals[0]?.total 
                      ? (cat.total / dashboardData.categoryTotals[0].total * 100) 
                      : 0;
                    return (
                      <div key={idx} className="flex items-center gap-3">
                        <div 
                          className="w-3 h-3 rounded-full flex-shrink-0" 
                          style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
                        ></div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center mb-1">
                            <span className={clsx("text-sm font-medium truncate", theme.text)}>{cat.category}</span>
                            <span className={clsx("text-sm font-bold ml-2", theme.text)}>{formatCurrency(cat.total)}</span>
                          </div>
                          <div className={clsx("h-2 rounded-full overflow-hidden", darkMode ? "bg-white/5" : "bg-black/5")}>
                            <div 
                              className="h-full rounded-full transition-all duration-500"
                              style={{ 
                                width: `${percentage}%`,
                                backgroundColor: CHART_COLORS[idx % CHART_COLORS.length]
                              }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Top Categorias - Gráfico de Barras Horizontal */}
            <div className={clsx("rounded-2xl p-6 border", theme.card, theme.cardBorder)}>
              <h3 className={clsx("text-lg font-semibold mb-6", theme.text)}>Top Categorias</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={dashboardData.categoryTotals.slice(0, 6).reverse().map((cat, idx) => ({
                      name: cat.category.length > 15 ? cat.category.substring(0, 15) + '...' : cat.category,
                      value: cat.total,
                      fullName: cat.category
                    }))}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'} />
                    <XAxis 
                      type="number" 
                      tickFormatter={(value) => formatCurrency(value)}
                      stroke={darkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'}
                    />
                    <YAxis 
                      type="category" 
                      dataKey="name" 
                      width={100}
                      stroke={darkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'}
                    />
                    <Tooltip 
                      formatter={(value, name, props) => [
                        formatCurrency(value),
                        props.payload.fullName
                      ]}
                      contentStyle={{
                        backgroundColor: darkMode ? '#1a1a2e' : '#ffffff',
                        border: `1px solid ${darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                        borderRadius: '8px',
                        color: darkMode ? '#ffffff' : '#000000'
                      }}
                    />
                    <Bar 
                      dataKey="value" 
                      radius={[0, 8, 8, 0]}
                    >
                      {dashboardData.categoryTotals.slice(0, 6).reverse().map((cat, idx) => (
                        <Cell key={`cell-${idx}`} fill={CHART_COLORS[(5 - idx) % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Projeção de Entradas */}
            <div className={clsx("rounded-2xl p-6 border", theme.card, theme.cardBorder)}>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className={clsx("text-lg font-semibold mb-1", theme.text)}>Projeção de Entradas</h3>
                  <p className={clsx("text-sm", theme.textMuted)}>
                    Baseado na média dos últimos 6 meses
                  </p>
                </div>
                <div className="text-right">
                  <p className={clsx("text-xs uppercase tracking-wider mb-1", theme.textMuted)}>Média Mensal</p>
                  <p className={clsx("text-2xl font-bold text-[#00D4FF]", theme.text)}>
                    {formatCurrency(incomeProjection.monthlyAverage)}
                  </p>
                </div>
              </div>
              
              {/* Gráfico de Projeção */}
              <div className="h-64 mb-6">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={[
                      ...incomeProjection.historicalMonths.slice(-3).map(m => ({
                        month: new Date(m.month + '-01').toLocaleDateString('pt-BR', { month: 'short' }),
                        value: m.income,
                        type: 'histórico'
                      })),
                      ...incomeProjection.projection.map(p => ({
                        month: p.month.split(' ')[0],
                        value: p.projectedIncome,
                        type: 'projeção'
                      }))
                    ]}
                    margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#00D4FF" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#00D4FF" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'} />
                    <XAxis 
                      dataKey="month" 
                      stroke={darkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis 
                      tickFormatter={(value) => formatCurrency(value)}
                      stroke={darkMode ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'}
                      tick={{ fontSize: 12 }}
                    />
                    <Tooltip 
                      formatter={(value) => formatCurrency(value)}
                      contentStyle={{
                        backgroundColor: darkMode ? '#1a1a2e' : '#ffffff',
                        border: `1px solid ${darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                        borderRadius: '8px',
                        color: darkMode ? '#ffffff' : '#000000'
                      }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="value" 
                      stroke="#00D4FF" 
                      strokeWidth={2}
                      fill="url(#incomeGradient)"
                      dot={{ fill: '#00D4FF', r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Lista de Projeção Mensal */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {incomeProjection.projection.map((proj, idx) => (
                  <div
                    key={idx}
                    className={clsx(
                      "p-4 rounded-lg border relative overflow-hidden",
                      theme.card,
                      theme.border,
                      "hover:scale-[1.02] transition-transform"
                    )}
                  >
                    <div className="absolute top-0 right-0 w-20 h-20 bg-[#00D4FF]/5 rounded-full blur-2xl -z-0"></div>
                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-2">
                        <span className={clsx("text-sm font-medium", theme.text)}>{proj.month}</span>
                        <span className="px-2 py-0.5 rounded-full text-xs bg-[#00D4FF]/20 text-[#00D4FF] border border-[#00D4FF]/30">
                          Projeção
                        </span>
                      </div>
                      <p className={clsx("text-xl font-bold text-[#00D4FF]", theme.text)}>
                        {formatCurrency(proj.projectedIncome)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Todas as Categorias - Lista Completa */}
            <div className={clsx("rounded-2xl p-6 border", theme.card, theme.cardBorder)}>
              <h3 className={clsx("text-lg font-semibold mb-6", theme.text)}>Todas as Categorias</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[500px] overflow-y-auto">
                {dashboardData.categoryTotals.map((cat, idx) => {
                  const percentage = dashboardData.categoryTotals[0]?.total 
                    ? (cat.total / dashboardData.categoryTotals[0].total * 100) 
                    : 0;
                  return (
                    <div 
                      key={idx} 
                      className={clsx("p-4 rounded-lg border", theme.card, theme.border, "hover:scale-[1.02] transition-transform")}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <div 
                          className="w-2 h-2 rounded-full" 
                          style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
                        ></div>
                        <span className={clsx("text-sm font-medium", theme.text)}>{cat.category}</span>
                      </div>
                      <p className={clsx("text-lg font-bold mb-2", theme.text)}>{formatCurrency(cat.total)}</p>
                      <div className={clsx("h-1.5 rounded-full overflow-hidden", darkMode ? "bg-white/5" : "bg-black/5")}>
                        <div 
                          className="h-full rounded-full transition-all duration-500"
                          style={{ 
                            width: `${percentage}%`,
                            backgroundColor: CHART_COLORS[idx % CHART_COLORS.length]
                          }}
                        ></div>
                      </div>
                      <p className={clsx("text-xs mt-1", theme.textMuted)}>{percentage.toFixed(1)}% do total</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modals */}
      {showCredentialsModal && (
        <CredentialsManager onClose={() => setShowCredentialsModal(false)} />
      )}

      {showPluggyItemsModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50">
          <div className="bg-[#0f0f18] rounded-2xl shadow-2xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto border border-white/10">
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Gerenciar Contas</h2>
              <button onClick={() => setShowPluggyItemsModal(false)} className="text-[#64748b] hover:text-white transition-colors">✕</button>
            </div>
            <PluggyItemsManager onClose={() => setShowPluggyItemsModal(false)} onSyncSuccess={loadDashboard} />
          </div>
        </div>
      )}

      {/* Loan Modal */}
      {showLoanModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50">
          <div className={clsx("relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl p-6 m-4 border", theme.card, theme.cardBorder)}>
            <div className="flex items-center justify-between mb-6">
              <h2 className={clsx("text-xl font-semibold", theme.text)}>
                {editingLoan ? 'Editar Empréstimo' : 'Adicionar Empréstimo'}
              </h2>
              <button 
                onClick={handleCloseLoanModal}
                className={clsx("text-lg hover:opacity-70 transition-opacity", theme.textMuted)}
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className={clsx("block text-sm font-medium mb-2", theme.text)}>Descrição *</label>
                <input
                  type="text"
                  value={loanForm.description}
                  onChange={(e) => setLoanForm({ ...loanForm, description: e.target.value })}
                  className={clsx("w-full px-4 py-2 rounded-lg border", theme.cardBorder, "bg-transparent", theme.text)}
                  placeholder="Ex: Empréstimo Consignado"
                />
              </div>

              <div>
                <label className={clsx("block text-sm font-medium mb-2", theme.text)}>Tipo</label>
                <select
                  value={loanForm.type}
                  onChange={(e) => setLoanForm({ ...loanForm, type: e.target.value })}
                  className={clsx("w-full px-4 py-2 rounded-lg border", theme.cardBorder, "bg-transparent", theme.text)}
                >
                  <option value="Outro">Outro</option>
                  <option value="Consignado">Consignado</option>
                  <option value="Pessoal">Pessoal</option>
                  <option value="Imobiliário">Imobiliário</option>
                  <option value="Veículo">Veículo</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={clsx("block text-sm font-medium mb-2", theme.text)}>Banco</label>
                  <input
                    type="text"
                    value={loanForm.bankName}
                    onChange={(e) => setLoanForm({ ...loanForm, bankName: e.target.value })}
                    className={clsx("w-full px-4 py-2 rounded-lg border", theme.cardBorder, "bg-transparent", theme.text)}
                    placeholder="Ex: Nubank"
                  />
                </div>
                <div>
                  <label className={clsx("block text-sm font-medium mb-2", theme.text)}>De Quem É</label>
                  <select
                    value={loanForm.ownerName}
                    onChange={(e) => setLoanForm({ ...loanForm, ownerName: e.target.value })}
                    className={clsx("w-full px-4 py-2 rounded-lg border", theme.cardBorder, "bg-transparent", theme.text)}
                  >
                    <option value="">Selecione</option>
                    <option value="Robert Oliveira">Robert Oliveira</option>
                    <option value="Larissa">Larissa</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={clsx("block text-sm font-medium mb-2", theme.text)}>Valor Total *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={loanForm.totalAmount}
                    onChange={(e) => {
                      const value = e.target.value;
                      setLoanForm({ 
                        ...loanForm, 
                        totalAmount: value,
                        installmentValue: loanForm.totalInstallments ? (parseFloat(value) / parseInt(loanForm.totalInstallments)).toFixed(2) : loanForm.installmentValue
                      });
                    }}
                    className={clsx("w-full px-4 py-2 rounded-lg border", theme.cardBorder, "bg-transparent", theme.text)}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className={clsx("block text-sm font-medium mb-2", theme.text)}>Total de Parcelas *</label>
                  <input
                    type="number"
                    value={loanForm.totalInstallments}
                    onChange={(e) => {
                      const value = e.target.value;
                      setLoanForm({ 
                        ...loanForm, 
                        totalInstallments: value,
                        installmentValue: value && loanForm.totalAmount ? (parseFloat(loanForm.totalAmount) / parseInt(value)).toFixed(2) : loanForm.installmentValue
                      });
                    }}
                    className={clsx("w-full px-4 py-2 rounded-lg border", theme.cardBorder, "bg-transparent", theme.text)}
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={clsx("block text-sm font-medium mb-2", theme.text)}>Parcelas Pagas</label>
                  <input
                    type="number"
                    value={loanForm.paidInstallments}
                    onChange={(e) => setLoanForm({ ...loanForm, paidInstallments: e.target.value })}
                    className={clsx("w-full px-4 py-2 rounded-lg border", theme.cardBorder, "bg-transparent", theme.text)}
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className={clsx("block text-sm font-medium mb-2", theme.text)}>Valor da Parcela</label>
                  <input
                    type="number"
                    step="0.01"
                    value={loanForm.installmentValue}
                    onChange={(e) => setLoanForm({ ...loanForm, installmentValue: e.target.value })}
                    className={clsx("w-full px-4 py-2 rounded-lg border", theme.cardBorder, "bg-transparent", theme.text)}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={clsx("block text-sm font-medium mb-2", theme.text)}>Taxa de Juros ao Ano (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={loanForm.interestRate}
                    onChange={(e) => setLoanForm({ ...loanForm, interestRate: e.target.value })}
                    className={clsx("w-full px-4 py-2 rounded-lg border", theme.cardBorder, "bg-transparent", theme.text)}
                    placeholder="Ex: 12.5"
                  />
                </div>
                <div>
                  <label className={clsx("block text-sm font-medium mb-2", theme.text)}>Dia de Vencimento</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={loanForm.dueDate}
                    onChange={(e) => {
                      const day = e.target.value;
                      if (day === '' || (parseInt(day) >= 1 && parseInt(day) <= 31)) {
                        setLoanForm({ ...loanForm, dueDate: day });
                      }
                    }}
                    className={clsx("w-full px-4 py-2 rounded-lg border", theme.cardBorder, "bg-transparent", theme.text)}
                    placeholder="Ex: 15"
                  />
                  <p className={clsx("text-xs mt-1", theme.textMuted)}>Dia do mês (1-31)</p>
                </div>
              </div>

              <div>
                <label className={clsx("block text-sm font-medium mb-2", theme.text)}>Forma de Pagamento</label>
                <select
                  value={loanForm.paymentMethod}
                  onChange={(e) => setLoanForm({ ...loanForm, paymentMethod: e.target.value })}
                  className={clsx("w-full px-4 py-2 rounded-lg border", theme.cardBorder, "bg-transparent", theme.text)}
                >
                  <option value="">Selecione</option>
                  <option value="Débito Automático">Débito Automático</option>
                  <option value="Desconto em Folha">Desconto em Folha</option>
                  <option value="Boleto">Boleto</option>
                  <option value="PIX">PIX</option>
                  <option value="Transferência">Transferência</option>
                  <option value="Cartão de Crédito">Cartão de Crédito</option>
                  <option value="Outro">Outro</option>
                </select>
              </div>

              <div className="flex gap-3 justify-end mt-6">
                <button
                  onClick={handleCloseLoanModal}
                  className={clsx("px-4 py-2 rounded-lg font-medium transition-all", theme.cardBorder, theme.textMuted, "hover:opacity-70")}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveLoan}
                  disabled={!loanForm.description || !loanForm.totalAmount || !loanForm.totalInstallments}
                  className={clsx(
                    "px-4 py-2 rounded-lg font-medium transition-all",
                    "bg-[#00D4FF] text-white hover:bg-[#00D4FF]/80",
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                >
                  {editingLoan ? 'Salvar Alterações' : 'Adicionar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Transaction Modal */}
      {showTransactionModal && selectedLoanForTransaction && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50">
          <div className={clsx("relative w-full max-w-md rounded-2xl p-6 m-4 border", theme.card, theme.cardBorder)}>
            <div className="flex items-center justify-between mb-6">
              <h2 className={clsx("text-xl font-semibold", theme.text)}>
                Adicionar Pagamento
              </h2>
              <button 
                onClick={handleCloseTransactionModal}
                className={clsx("text-lg hover:opacity-70 transition-opacity", theme.textMuted)}
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className={clsx("block text-sm font-medium mb-2", theme.text)}>Data *</label>
                <input
                  type="date"
                  value={transactionForm.date}
                  onChange={(e) => setTransactionForm({ ...transactionForm, date: e.target.value })}
                  className={clsx("w-full px-4 py-2 rounded-lg border", theme.cardBorder, "bg-transparent", theme.text)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={clsx("block text-sm font-medium mb-2", theme.text)}>Valor *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={transactionForm.amount}
                    onChange={(e) => setTransactionForm({ ...transactionForm, amount: e.target.value })}
                    className={clsx("w-full px-4 py-2 rounded-lg border", theme.cardBorder, "bg-transparent", theme.text)}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className={clsx("block text-sm font-medium mb-2", theme.text)}>Número da Parcela</label>
                  <input
                    type="number"
                    value={transactionForm.installmentNumber}
                    onChange={(e) => setTransactionForm({ ...transactionForm, installmentNumber: e.target.value })}
                    className={clsx("w-full px-4 py-2 rounded-lg border", theme.cardBorder, "bg-transparent", theme.text)}
                    placeholder="Ex: 1"
                  />
                </div>
              </div>

              <div>
                <label className={clsx("block text-sm font-medium mb-2", theme.text)}>Descrição</label>
                <input
                  type="text"
                  value={transactionForm.description}
                  onChange={(e) => setTransactionForm({ ...transactionForm, description: e.target.value })}
                  className={clsx("w-full px-4 py-2 rounded-lg border", theme.cardBorder, "bg-transparent", theme.text)}
                  placeholder="Ex: Parcela 1/150"
                />
              </div>

              <div className="flex gap-3 justify-end mt-6">
                <button
                  onClick={handleCloseTransactionModal}
                  className={clsx("px-4 py-2 rounded-lg font-medium transition-all", theme.cardBorder, theme.textMuted, "hover:opacity-70")}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveTransaction}
                  disabled={!transactionForm.date || !transactionForm.amount}
                  className={clsx(
                    "px-4 py-2 rounded-lg font-medium transition-all",
                    "bg-[#00FF94] text-white hover:bg-[#00FF94]/80",
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                >
                  Adicionar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Transaction Modal */}
      {showTransactionModal && selectedLoanForTransaction && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50">
          <div className={clsx("relative w-full max-w-md rounded-2xl p-6 m-4 border", theme.card, theme.cardBorder)}>
            <div className="flex items-center justify-between mb-6">
              <h2 className={clsx("text-xl font-semibold", theme.text)}>
                Adicionar Pagamento
              </h2>
              <button 
                onClick={handleCloseTransactionModal}
                className={clsx("text-lg hover:opacity-70 transition-opacity", theme.textMuted)}
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className={clsx("block text-sm font-medium mb-2", theme.text)}>Data *</label>
                <input
                  type="date"
                  value={transactionForm.date}
                  onChange={(e) => setTransactionForm({ ...transactionForm, date: e.target.value })}
                  className={clsx("w-full px-4 py-2 rounded-lg border", theme.cardBorder, "bg-transparent", theme.text)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={clsx("block text-sm font-medium mb-2", theme.text)}>Valor *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={transactionForm.amount}
                    onChange={(e) => setTransactionForm({ ...transactionForm, amount: e.target.value })}
                    className={clsx("w-full px-4 py-2 rounded-lg border", theme.cardBorder, "bg-transparent", theme.text)}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className={clsx("block text-sm font-medium mb-2", theme.text)}>Número da Parcela</label>
                  <input
                    type="number"
                    value={transactionForm.installmentNumber}
                    onChange={(e) => setTransactionForm({ ...transactionForm, installmentNumber: e.target.value })}
                    className={clsx("w-full px-4 py-2 rounded-lg border", theme.cardBorder, "bg-transparent", theme.text)}
                    placeholder="Ex: 1"
                  />
                </div>
              </div>

              <div>
                <label className={clsx("block text-sm font-medium mb-2", theme.text)}>Descrição</label>
                <input
                  type="text"
                  value={transactionForm.description}
                  onChange={(e) => setTransactionForm({ ...transactionForm, description: e.target.value })}
                  className={clsx("w-full px-4 py-2 rounded-lg border", theme.cardBorder, "bg-transparent", theme.text)}
                  placeholder="Ex: Parcela 1/150"
                />
              </div>

              <div className="flex gap-3 justify-end mt-6">
                <button
                  onClick={handleCloseTransactionModal}
                  className={clsx("px-4 py-2 rounded-lg font-medium transition-all", theme.cardBorder, theme.textMuted, "hover:opacity-70")}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveTransaction}
                  disabled={!transactionForm.date || !transactionForm.amount}
                  className={clsx(
                    "px-4 py-2 rounded-lg font-medium transition-all",
                    "bg-[#00FF94] text-white hover:bg-[#00FF94]/80",
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                >
                  Adicionar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Expected Expense Modal */}
      {showExpectedExpenseModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50">
          <div className={clsx("relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl p-6 m-4 border", theme.card, theme.cardBorder)}>
            <div className="flex items-center justify-between mb-6">
              <h2 className={clsx("text-xl font-semibold", theme.text)}>
                {editingExpectedExpense ? 'Editar Gasto Previsto' : 'Adicionar Gasto Previsto'}
              </h2>
              <button 
                onClick={handleCloseExpectedExpenseModal}
                className={clsx("text-lg hover:opacity-70 transition-opacity", theme.textMuted)}
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className={clsx("block text-sm font-medium mb-2", theme.text)}>Gasto *</label>
                <input
                  type="text"
                  value={expectedExpenseForm.name}
                  onChange={(e) => setExpectedExpenseForm({ ...expectedExpenseForm, name: e.target.value })}
                  className={clsx("w-full px-4 py-2 rounded-lg border", theme.cardBorder, "bg-transparent", theme.text)}
                  placeholder="Ex: Aluguel"
                />
              </div>

              <div>
                <label className={clsx("block text-sm font-medium mb-2", theme.text)}>Valor *</label>
                <input
                  type="number"
                  step="0.01"
                  value={expectedExpenseForm.amount}
                  onChange={(e) => setExpectedExpenseForm({ ...expectedExpenseForm, amount: e.target.value })}
                  className={clsx("w-full px-4 py-2 rounded-lg border", theme.cardBorder, "bg-transparent", theme.text)}
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className={clsx("block text-sm font-medium mb-2", theme.text)}>Data de Encerramento</label>
                <input
                  type="date"
                  value={expectedExpenseForm.endDate}
                  onChange={(e) => setExpectedExpenseForm({ ...expectedExpenseForm, endDate: e.target.value })}
                  className={clsx("w-full px-4 py-2 rounded-lg border", theme.cardBorder, "bg-transparent", theme.text)}
                />
                <p className={clsx("text-xs mt-1", theme.textMuted)}>Deixe em branco para "Indeterminado"</p>
              </div>

              <div>
                <label className={clsx("block text-sm font-medium mb-2", theme.text)}>Forma de Pagamento *</label>
                <select
                  value={expectedExpenseForm.paymentMethod}
                  onChange={(e) => setExpectedExpenseForm({ ...expectedExpenseForm, paymentMethod: e.target.value })}
                  className={clsx("w-full px-4 py-2 rounded-lg border", theme.cardBorder, "bg-transparent", theme.text)}
                >
                  <option value="Pix">Pix</option>
                  <option value="Débito Automático">Débito Automático</option>
                  <option value="Boleto">Boleto</option>
                  <option value="Transferência">Transferência</option>
                  <option value="Cartão de Crédito">Cartão de Crédito</option>
                  <option value="Cartão de Débito">Cartão de Débito</option>
                  <option value="Dinheiro">Dinheiro</option>
                  <option value="Outro">Outro</option>
                </select>
              </div>

              <div className="flex gap-3 justify-end mt-6">
                <button
                  onClick={handleCloseExpectedExpenseModal}
                  className={clsx("px-4 py-2 rounded-lg font-medium transition-all", theme.cardBorder, theme.textMuted, "hover:opacity-70")}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveExpectedExpense}
                  disabled={!expectedExpenseForm.name || !expectedExpenseForm.amount || !expectedExpenseForm.paymentMethod}
                  className={clsx(
                    "px-4 py-2 rounded-lg font-medium transition-all",
                    "bg-[#00D4FF] text-white hover:bg-[#00D4FF]/80",
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                >
                  {editingExpectedExpense ? 'Salvar Alterações' : 'Adicionar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Goal Modal */}
      {showGoalModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50">
          <div className={clsx("relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl p-6 m-4 border", theme.card, theme.cardBorder)}>
            <div className="flex items-center justify-between mb-6">
              <h2 className={clsx("text-xl font-semibold", theme.text)}>
                {editingGoal ? 'Editar Meta' : 'Adicionar Meta'}
              </h2>
              <button 
                onClick={handleCloseGoalModal}
                className={clsx("text-lg hover:opacity-70 transition-opacity", theme.textMuted)}
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className={clsx("block text-sm font-medium mb-2", theme.text)}>Nome da Meta (Categoria) *</label>
                <select
                  value={goalForm.name}
                  onChange={(e) => setGoalForm({ ...goalForm, name: e.target.value })}
                  className={clsx("w-full px-4 py-2 rounded-lg border", theme.cardBorder, "bg-transparent", theme.text)}
                >
                  <option value="">Selecione uma categoria</option>
                  <option value="Refeição">Refeição</option>
                  <option value="Transporte">Transporte</option>
                  <option value="Moradia">Moradia</option>
                  <option value="Saúde">Saúde</option>
                  <option value="Farmácia">Farmácia</option>
                  <option value="Compras">Compras</option>
                  <option value="Entretenimento">Entretenimento</option>
                  <option value="Educação">Educação</option>
                  <option value="Serviços">Serviços</option>
                  <option value="Pet">Pet</option>
                  <option value="Feira">Feira</option>
                  <option value="Mercado">Mercado</option>
                  <option value="Fatura">Fatura</option>
                  <option value="Empréstimo">Empréstimo</option>
                  <option value="Transferência">Transferência</option>
                  <option value="Investimentos">Investimentos</option>
                  <option value="Outros">Outros</option>
                </select>
                <p className={clsx("text-xs mt-1", theme.textMuted)}>O sistema calculará automaticamente os gastos desta categoria</p>
              </div>

              <div>
                <label className={clsx("block text-sm font-medium mb-2", theme.text)}>Valor Teto *</label>
                <input
                  type="number"
                  step="0.01"
                  value={goalForm.targetAmount}
                  onChange={(e) => setGoalForm({ ...goalForm, targetAmount: e.target.value })}
                  className={clsx("w-full px-4 py-2 rounded-lg border", theme.cardBorder, "bg-transparent", theme.text)}
                  placeholder="0.00"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={clsx("block text-sm font-medium mb-2", theme.text)}>Mês *</label>
                  <select
                    value={goalForm.periodMonth}
                    onChange={(e) => setGoalForm({ ...goalForm, periodMonth: parseInt(e.target.value) })}
                    className={clsx("w-full px-4 py-2 rounded-lg border", theme.cardBorder, "bg-transparent", theme.text)}
                  >
                    <option value="1">Janeiro</option>
                    <option value="2">Fevereiro</option>
                    <option value="3">Março</option>
                    <option value="4">Abril</option>
                    <option value="5">Maio</option>
                    <option value="6">Junho</option>
                    <option value="7">Julho</option>
                    <option value="8">Agosto</option>
                    <option value="9">Setembro</option>
                    <option value="10">Outubro</option>
                    <option value="11">Novembro</option>
                    <option value="12">Dezembro</option>
                  </select>
                </div>
                <div>
                  <label className={clsx("block text-sm font-medium mb-2", theme.text)}>Ano *</label>
                  <input
                    type="number"
                    value={goalForm.periodYear}
                    onChange={(e) => setGoalForm({ ...goalForm, periodYear: parseInt(e.target.value) })}
                    className={clsx("w-full px-4 py-2 rounded-lg border", theme.cardBorder, "bg-transparent", theme.text)}
                    placeholder="2025"
                    min="2020"
                    max="2100"
                  />
                </div>
              </div>

              <div className="flex gap-3 justify-end mt-6">
                <button
                  onClick={handleCloseGoalModal}
                  className={clsx("px-4 py-2 rounded-lg font-medium transition-all", theme.cardBorder, theme.textMuted, "hover:opacity-70")}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveGoal}
                  disabled={!goalForm.name || !goalForm.targetAmount || !goalForm.periodMonth || !goalForm.periodYear}
                  className={clsx(
                    "px-4 py-2 rounded-lg font-medium transition-all",
                    "bg-[#FFB800] text-white hover:bg-[#FFB800]/80",
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                >
                  {editingGoal ? 'Salvar Alterações' : 'Adicionar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

        {/* Financial Goal Modal */}
        {showFinancialGoalModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50">
            <div className={clsx("relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl p-6 m-4 border", theme.card, theme.cardBorder)}>
              <div className="flex items-center justify-between mb-6">
                <h2 className={clsx("text-xl font-semibold", theme.text)}>
                  {editingFinancialGoal ? 'Editar Meta' : 'Adicionar Meta'}
                </h2>
                <button 
                  onClick={handleCloseFinancialGoalModal}
                  className={clsx("text-lg hover:opacity-70 transition-opacity", theme.textMuted)}
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className={clsx("block text-sm font-medium mb-2", theme.text)}>Nome da Meta *</label>
                  <input
                    type="text"
                    value={financialGoalForm.name}
                    onChange={(e) => setFinancialGoalForm({ ...financialGoalForm, name: e.target.value })}
                    className={clsx("w-full px-4 py-2 rounded-lg border", theme.cardBorder, "bg-transparent", theme.text)}
                    placeholder="Ex: Reserva de Emergência, iPhone 15, Viagem para Europa"
                  />
                </div>

                <div>
                  <label className={clsx("block text-sm font-medium mb-2", theme.text)}>Tipo *</label>
                  <select
                    value={financialGoalForm.type}
                    onChange={(e) => setFinancialGoalForm({ ...financialGoalForm, type: e.target.value })}
                    className={clsx("w-full px-4 py-2 rounded-lg border", theme.cardBorder, "bg-transparent", theme.text)}
                  >
                    <option value="custom">Personalizada</option>
                    <option value="emergency_fund">Reserva de Emergência</option>
                    <option value="purchase">Compra Planejada</option>
                    <option value="travel">Viagem</option>
                    <option value="investment">Investimento</option>
                    <option value="education">Educação</option>
                  </select>
                  {financialGoalForm.type === 'emergency_fund' && (
                    <p className={clsx("text-xs mt-1", theme.textMuted)}>
                      A reserva de emergência será calculada automaticamente com base no saldo atual das suas contas
                    </p>
                  )}
                </div>

                <div>
                  <label className={clsx("block text-sm font-medium mb-2", theme.text)}>Valor Alvo *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={financialGoalForm.targetAmount}
                    onChange={(e) => setFinancialGoalForm({ ...financialGoalForm, targetAmount: e.target.value })}
                    className={clsx("w-full px-4 py-2 rounded-lg border", theme.cardBorder, "bg-transparent", theme.text)}
                    placeholder="0.00"
                  />
                  {financialGoalForm.type === 'emergency_fund' && (
                    <p className={clsx("text-xs mt-1", theme.textMuted)}>
                      Recomendado: 6 meses de gastos mensais
                    </p>
                  )}
                </div>

                {financialGoalForm.type !== 'emergency_fund' && !financialGoalForm.tag && (
                  <div>
                    <label className={clsx("block text-sm font-medium mb-2", theme.text)}>Valor Atual</label>
                    <input
                      type="number"
                      step="0.01"
                      value={financialGoalForm.currentAmount}
                      onChange={(e) => setFinancialGoalForm({ ...financialGoalForm, currentAmount: e.target.value })}
                      className={clsx("w-full px-4 py-2 rounded-lg border", theme.cardBorder, "bg-transparent", theme.text)}
                      placeholder="0.00"
                    />
                    <p className={clsx("text-xs mt-1", theme.textMuted)}>
                      Quanto você já tem guardado para esta meta. Se você definir uma tag abaixo, este valor será calculado automaticamente.
                    </p>
                  </div>
                )}
                {financialGoalForm.tag && (
                  <div className={clsx("p-3 rounded-lg border", "bg-[#00D4FF]/10 border-[#00D4FF]/30")}>
                    <p className={clsx("text-xs font-medium mb-1 text-[#00D4FF]")}>ℹ️ Valor Atual Automático</p>
                    <p className={clsx("text-xs", theme.textMuted)}>
                      O valor atual será calculado automaticamente somando todas as transações com a tag "{financialGoalForm.tag}"
                    </p>
                  </div>
                )}

                <div>
                  <label className={clsx("block text-sm font-medium mb-2", theme.text)}>Descrição</label>
                  <textarea
                    value={financialGoalForm.description}
                    onChange={(e) => setFinancialGoalForm({ ...financialGoalForm, description: e.target.value })}
                    className={clsx("w-full px-4 py-2 rounded-lg border", theme.cardBorder, "bg-transparent", theme.text)}
                    placeholder="Adicione uma descrição ou observação sobre esta meta"
                    rows="3"
                  />
                </div>

                <div>
                  <label className={clsx("block text-sm font-medium mb-2", theme.text)}>Tag/Categoria (Opcional)</label>
                  <select
                    value={financialGoalForm.tag}
                    onChange={(e) => setFinancialGoalForm({ ...financialGoalForm, tag: e.target.value })}
                    className={clsx("w-full px-4 py-2 rounded-lg border", theme.cardBorder, "bg-transparent", theme.text)}
                  >
                    <option value="">Selecione uma tag...</option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                  <p className={clsx("text-xs mt-1", theme.textMuted)}>
                    Selecione a tag/categoria das transações que serão somadas automaticamente para esta meta
                  </p>
                </div>

                <div>
                  <label className={clsx("block text-sm font-medium mb-2", theme.text)}>Data Alvo (Opcional)</label>
                  <input
                    type="date"
                    value={financialGoalForm.targetDate}
                    onChange={(e) => setFinancialGoalForm({ ...financialGoalForm, targetDate: e.target.value })}
                    className={clsx("w-full px-4 py-2 rounded-lg border", theme.cardBorder, "bg-transparent", theme.text)}
                  />
                  <p className={clsx("text-xs mt-1", theme.textMuted)}>
                    Quando você pretende alcançar esta meta. Se definida, será calculado o valor mensal necessário.
                  </p>
                </div>

                <div className="flex gap-3 justify-end mt-6">
                  <button
                    onClick={handleCloseFinancialGoalModal}
                    className={clsx("px-4 py-2 rounded-lg font-medium transition-all", theme.cardBorder, theme.textMuted, "hover:opacity-70")}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSaveFinancialGoal}
                    disabled={!financialGoalForm.name || !financialGoalForm.targetAmount}
                    className={clsx(
                      "px-4 py-2 rounded-lg font-medium transition-all",
                      "bg-[#00D4FF] text-white hover:bg-[#00D4FF]/80",
                      "disabled:opacity-50 disabled:cursor-not-allowed"
                    )}
                  >
                    {editingFinancialGoal ? 'Atualizar' : 'Criar'} Meta
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Due Date Modal */}
        {showDueDateModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50">
            <div className={clsx("relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl p-6 m-4 border", theme.card, theme.cardBorder)}>
              <div className="flex items-center justify-between mb-6">
                <h2 className={clsx("text-xl font-semibold", theme.text)}>
                  {editingDueDate ? 'Editar Vencimento' : 'Adicionar Vencimento'}
                </h2>
                <button 
                  onClick={() => {
                    setShowDueDateModal(false);
                    setEditingDueDate(null);
                  }}
                  className={clsx("text-lg hover:opacity-70 transition-opacity", theme.textMuted)}
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className={clsx("block text-sm font-medium mb-2", theme.text)}>Nome *</label>
                  <input
                    type="text"
                    value={dueDateForm.name}
                    onChange={(e) => setDueDateForm({ ...dueDateForm, name: e.target.value })}
                    className={clsx("w-full px-4 py-2 rounded-lg border", theme.cardBorder, "bg-transparent", theme.text)}
                    placeholder="Ex: Aluguel, Conta de Luz, etc."
                  />
                </div>

                <div>
                  <label className={clsx("block text-sm font-medium mb-2", theme.text)}>Tipo</label>
                  <select
                    value={dueDateForm.type}
                    onChange={(e) => setDueDateForm({ ...dueDateForm, type: e.target.value })}
                    className={clsx("w-full px-4 py-2 rounded-lg border", theme.cardBorder, "bg-transparent", theme.text)}
                  >
                    <option value="custom">Personalizado</option>
                    <option value="bill">Conta</option>
                    <option value="loan">Empréstimo</option>
                    <option value="subscription">Assinatura</option>
                  </select>
                </div>

                <div>
                  <label className={clsx("block text-sm font-medium mb-2", theme.text)}>Valor</label>
                  <input
                    type="number"
                    step="0.01"
                    value={dueDateForm.amount}
                    onChange={(e) => setDueDateForm({ ...dueDateForm, amount: e.target.value })}
                    className={clsx("w-full px-4 py-2 rounded-lg border", theme.cardBorder, "bg-transparent", theme.text)}
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className={clsx("block text-sm font-medium mb-2", theme.text)}>Dia do Vencimento *</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={dueDateForm.due_day}
                    onChange={(e) => setDueDateForm({ ...dueDateForm, due_day: e.target.value })}
                    className={clsx("w-full px-4 py-2 rounded-lg border", theme.cardBorder, "bg-transparent", theme.text)}
                    placeholder="1-31"
                  />
                </div>

                <div className="flex gap-3 justify-end mt-6">
                  <button
                    onClick={() => {
                      setShowDueDateModal(false);
                      setEditingDueDate(null);
                    }}
                    className={clsx("px-4 py-2 rounded-lg font-medium transition-all", theme.cardBorder, theme.textMuted, "hover:opacity-70")}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSaveDueDate}
                    disabled={!dueDateForm.name || !dueDateForm.due_day}
                    className={clsx(
                      "px-4 py-2 rounded-lg font-medium transition-all",
                      "bg-[#00D4FF] text-white hover:bg-[#00D4FF]/80",
                      "disabled:opacity-50 disabled:cursor-not-allowed"
                    )}
                  >
                    {editingDueDate ? 'Atualizar' : 'Criar'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}

// Função auxiliar para calcular primeiro dia útil do mês
function getFirstBusinessDay(year, month) {
  // month é 1-indexed (1 = Janeiro, 12 = Dezembro)
  const monthIndex = month - 1; // Converter para 0-indexed
  const firstDay = new Date(year, monthIndex, 1);
  const dayOfWeek = firstDay.getDay(); // 0 = Domingo, 1 = Segunda, ..., 6 = Sábado
  
  if (dayOfWeek === 0) {
    // Se dia 1 é domingo, primeiro dia útil é dia 2 (segunda)
    return 2;
  } else if (dayOfWeek === 6) {
    // Se dia 1 é sábado, primeiro dia útil é dia 3 (segunda)
    return 3;
  } else {
    // Se dia 1 é segunda a sexta, primeiro dia útil é dia 1
    return 1;
  }
}

// Função para verificar se uma transação deve ser ignorada no resumo
function shouldIgnorePayment(tx, allTransactions, creditCardBills = []) {
  // Verificar apenas transações positivas (entradas)
  if (tx.amount <= 0) {
    return false;
  }
  
  // Verificar se é cartão de crédito
  if (tx.account_type !== 'CREDIT') {
    return false;
  }
  
  const txDate = new Date(tx.date);
  const txYear = txDate.getFullYear();
  const txMonth = txDate.getMonth() + 1; // 1-indexed
  const txDay = txDate.getDate();
  
  // Ignorar pagamentos no primeiro dia útil do mês
  const firstBusinessDay = getFirstBusinessDay(txYear, txMonth);
  if (txDay === firstBusinessDay) {
    return true;
  }
  
  // Para Larissa, também ignorar no dia de fechamento da fatura
  if (tx.owner_name === 'Larissa Purkot') {
    let closingDay;
    if (tx.bank_name === 'Itaú') {
      closingDay = 26; // Itaú Larissa fecha dia 26
    } else if (tx.bank_name === 'Nubank') {
      closingDay = 26; // Nubank Larissa fecha dia 26
    }
    
    if (closingDay && txDay === closingDay) {
      return true;
    }
  }
  
  // Comparar com TODAS as faturas (anteriores e futuras) que correspondem a este cartão
  // Verificar se o valor da entrada corresponde a alguma fatura
  // IMPORTANTE: Se o pagamento corresponde ao valor de uma fatura do mês seguinte,
  // deve ser ignorado pois é pagamento antecipado da fatura futura
  const tolerance = 0.01;
  const txAmount = Math.abs(tx.amount);
  
  for (const bill of creditCardBills) {
    // Verificar se corresponde ao mesmo cartão (banco + pessoa)
    if (bill.bankName === tx.bank_name && bill.ownerName === tx.owner_name) {
      const billAmount = Math.abs(bill.total || 0);
      
      // Se o valor corresponde (dentro da tolerância)
      if (billAmount > 0 && Math.abs(txAmount - billAmount) <= tolerance) {
        // Se a fatura está fechada (isOpen = false), definitivamente ignorar
        if (bill.isOpen === false) {
          return true;
        }
        
        // Se não tem informação de isOpen ou está undefined, verificar pela data
        // Se a fatura tem data de vencimento e a transação é anterior ou igual, ignorar
        if (bill.isOpen === undefined || bill.isOpen === null) {
          if (bill.dueDate) {
            const dueDate = new Date(bill.dueDate);
            // Se a transação é anterior ou igual à data de vencimento, é pagamento de fatura anterior
            if (txDate <= dueDate) {
              return true;
            }
            // Se a transação é posterior à data de vencimento mas o valor corresponde exatamente,
            // pode ser pagamento antecipado da fatura do mês seguinte
            // Verificar se a fatura vence no mês seguinte ao da transação
            const txMonth = txDate.getMonth() + 1;
            const txYear = txDate.getFullYear();
            const dueMonth = dueDate.getMonth() + 1;
            const dueYear = dueDate.getFullYear();
            
            // Se a fatura vence no mês seguinte ao da transação, é pagamento antecipado
            let expectedDueMonth = txMonth + 1;
            let expectedDueYear = txYear;
            if (expectedDueMonth > 12) {
              expectedDueMonth = 1;
              expectedDueYear = txYear + 1;
            }
            
            if (dueMonth === expectedDueMonth && dueYear === expectedDueYear) {
              return true; // Pagamento antecipado da fatura do mês seguinte
            }
          } else {
            // Se não tem data mas o valor corresponde, assumir que é fatura anterior
            return true;
          }
        }
        
        // Se a fatura está aberta mas o valor corresponde exatamente
        if (bill.isOpen === true && bill.dueDate) {
          const dueDate = new Date(bill.dueDate);
          // Se pagou antes do vencimento, é pagamento de fatura anterior
          if (txDate < dueDate) {
            return true;
          }
          
          // Se pagou depois do vencimento mas o valor corresponde, verificar se é fatura do mês seguinte
          // A fatura do mês X vence no mês X+1
          // Se estou pagando no mês X e o valor corresponde à fatura que vence no mês X+1, é pagamento antecipado
          const txMonth = txDate.getMonth() + 1;
          const txYear = txDate.getFullYear();
          const dueMonth = dueDate.getMonth() + 1;
          const dueYear = dueDate.getFullYear();
          
          // Se a fatura vence no mês seguinte ao da transação, é pagamento antecipado
          let expectedDueMonth = txMonth + 1;
          let expectedDueYear = txYear;
          if (expectedDueMonth > 12) {
            expectedDueMonth = 1;
            expectedDueYear = txYear + 1;
          }
          
          if (dueMonth === expectedDueMonth && dueYear === expectedDueYear) {
            return true; // Pagamento antecipado da fatura do mês seguinte
          }
        }
      }
    }
  }
  
  return false;
}

// Transaction Table Component
function TransactionTable({ transactions, title, formatCurrency, formatDate, editingCategory, setEditingCategory, newCategory, setNewCategory, handleUpdateCategory, theme = {}, darkMode = true, creditCardBills = [] }) {
  // Calcular totais, excluindo apenas transações com categoria "Fatura Anterior" nos cartões
  const totals = useMemo(() => {
    // Para cartões de crédito, excluir APENAS transações com categoria exata "Fatura Anterior"
    // Pagamentos do mês atual devem ser considerados normalmente
    let filteredTransactions = transactions;
    
    if (title === 'Cartão de Crédito' || title.includes('Cartão')) {
      filteredTransactions = transactions.filter(tx => 
        tx.category !== 'Fatura Anterior'
      );
    }
    
    const entradas = filteredTransactions.filter(tx => tx.amount > 0);
    const saidas = filteredTransactions.filter(tx => tx.amount < 0);
    const totalEntradas = entradas.reduce((sum, tx) => sum + tx.amount, 0);
    const totalSaidas = saidas.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
    
    // Calcular total: entradas - saídas
    const total = totalEntradas - totalSaidas;
    
    // Contar transações com "Fatura Anterior" que foram desconsideradas
    const ignoredFaturaAnterior = transactions.filter(tx => 
      (title === 'Cartão de Crédito' || title.includes('Cartão')) && 
      tx.category === 'Fatura Anterior'
    );
    
    return {
      numEntradas: entradas.length,
      numSaidas: saidas.length,
      totalEntradas,
      totalSaidas,
      total,
      ignoredCount: ignoredFaturaAnterior.length,
      ignoredAmount: ignoredFaturaAnterior.reduce((sum, tx) => sum + tx.amount, 0)
    };
  }, [transactions, title]);

  // Função para exportar CSV
  const exportToCSV = () => {
    const headers = ['Data', 'Banco', 'Pessoa', 'Descrição', 'Categoria', 'Valor'];
    const rows = transactions.map(tx => [
      formatDate(tx.date),
      tx.bank_name || '',
      tx.owner_name || '',
      tx.description || '',
      tx.category || '',
      tx.amount.toFixed(2)
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className={clsx("rounded-2xl overflow-hidden border", theme.card || "bg-white/[0.02]", theme.cardBorder || "border-white/5")}>
      <div className={clsx("px-6 py-4 border-b flex items-center justify-between", theme.border || "border-white/5")}>
        <h3 className={clsx("text-sm font-medium uppercase tracking-wider", darkMode ? "text-white/80" : "text-black/80")}>{title}</h3>
        <div className="flex items-center gap-4">
          <span className="text-xs text-[#64748b]">{transactions.length} transações</span>
          <button
            onClick={exportToCSV}
            className={clsx(
              "px-3 py-1.5 text-xs rounded-lg transition-all flex items-center gap-2",
              darkMode 
                ? "bg-white/5 hover:bg-white/10 text-white/80 hover:text-white border border-white/10" 
                : "bg-black/5 hover:bg-black/10 text-black/80 hover:text-black border border-black/10"
            )}
            title="Exportar para CSV"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            CSV
          </button>
        </div>
      </div>
      <div className="overflow-x-auto max-h-[400px] overflow-y-auto relative">
        <table className="w-full">
          <thead className={clsx("sticky top-0 z-10", darkMode ? "bg-[#0a0a0f]" : "bg-[#f8fafc]")}>
            <tr>
              <th className={clsx("px-4 py-3 text-left text-[10px] font-medium text-[#64748b] uppercase tracking-wider", darkMode ? "bg-[#0a0a0f]" : "bg-[#f8fafc]")}>Data</th>
              <th className={clsx("px-4 py-3 text-left text-[10px] font-medium text-[#64748b] uppercase tracking-wider", darkMode ? "bg-[#0a0a0f]" : "bg-[#f8fafc]")}>Banco</th>
              <th className={clsx("px-4 py-3 text-left text-[10px] font-medium text-[#64748b] uppercase tracking-wider", darkMode ? "bg-[#0a0a0f]" : "bg-[#f8fafc]")}>Pessoa</th>
              <th className={clsx("px-4 py-3 text-left text-[10px] font-medium text-[#64748b] uppercase tracking-wider", darkMode ? "bg-[#0a0a0f]" : "bg-[#f8fafc]")}>Descrição</th>
              <th className={clsx("px-4 py-3 text-left text-[10px] font-medium text-[#64748b] uppercase tracking-wider", darkMode ? "bg-[#0a0a0f]" : "bg-[#f8fafc]")}>Categoria</th>
              <th className={clsx("px-4 py-3 text-right text-[10px] font-medium text-[#64748b] uppercase tracking-wider", darkMode ? "bg-[#0a0a0f]" : "bg-[#f8fafc]")}>Valor</th>
            </tr>
          </thead>
          <tbody className={clsx("divide-y", theme.border || "divide-white/5")}>
            {transactions.length === 0 ? (
              <tr>
                <td colSpan="6" className="px-4 py-12 text-center text-[#64748b]">
                  Nenhuma transação encontrada
                </td>
              </tr>
            ) : (
              transactions.map((tx) => (
                <tr key={tx.id} className={clsx("transition-colors", theme.cardHover || "hover:bg-white/[0.02]")}>
                  <td className="px-4 py-3 text-sm text-[#64748b]">{formatDate(tx.date)}</td>
                  <td className={clsx("px-4 py-3 text-sm", darkMode ? "text-white/80" : "text-black/80")}>{tx.bank_name || '-'}</td>
                  <td className={clsx("px-4 py-3 text-sm", darkMode ? "text-white/80" : "text-black/80")}>{tx.owner_name || '-'}</td>
                  <td className={clsx("px-4 py-3 text-sm max-w-[250px] truncate", theme.text)} title={tx.description}>
                    {tx.description}
                  </td>
                  <td className="px-4 py-3">
                    {editingCategory === tx.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={newCategory}
                          onChange={(e) => setNewCategory(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && handleUpdateCategory(tx.id)}
                          className={clsx("px-2 py-1 text-xs rounded w-24 focus:outline-none focus:border-[#00D4FF]/50", theme.input || "bg-white/5 border-white/10", theme.inputText || "text-white")}
                          autoFocus
                        />
                        <button onClick={() => handleUpdateCategory(tx.id)} className="text-[#00FF94] text-xs">✓</button>
                        <button onClick={() => { setEditingCategory(null); setNewCategory(''); }} className="text-[#FF4757] text-xs">✕</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setEditingCategory(tx.id); setNewCategory(tx.category); }}
                        className={clsx("px-2 py-1 text-xs text-[#00D4FF] rounded transition-colors", darkMode ? "bg-white/5 hover:bg-white/10" : "bg-black/5 hover:bg-black/10")}
                      >
                        {tx.category}
                      </button>
                    )}
                  </td>
                  <td className={clsx(
                    "px-4 py-3 text-sm text-right font-medium",
                    tx.amount >= 0 ? "text-[#00FF94]" : "text-[#FF4757]"
                  )}>
                    {formatCurrency(tx.amount)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {/* Linha de totais */}
          {transactions.length > 0 && (
            <tfoot className={clsx("border-t-2 sticky bottom-0 z-10", theme.border || "border-white/10", darkMode ? "bg-[#0a0a0f]" : "bg-[#f8fafc]")}>
              <tr className={clsx(darkMode ? "bg-[#0a0a0f]" : "bg-[#f8fafc]")}>
                <td colSpan="3" className={clsx("px-4 py-3", darkMode ? "bg-[#0a0a0f]" : "bg-[#f8fafc]")}>
                  <div className="flex flex-col gap-1">
                    <div className={clsx("text-xs font-medium", darkMode ? "text-white/80" : "text-black/80")}>
                      Resumo
                    </div>
                    <div className={clsx("text-[10px] flex gap-3", darkMode ? "text-white/60" : "text-black/60")}>
                      <span>Entradas: <span className={clsx("font-semibold", darkMode ? "text-white/90" : "text-black/90")}>{totals.numEntradas}</span></span>
                      <span>Saídas: <span className={clsx("font-semibold", darkMode ? "text-white/90" : "text-black/90")}>{totals.numSaidas}</span></span>
                    </div>
                  </div>
                </td>
                <td className={clsx("px-4 py-3", darkMode ? "bg-[#0a0a0f]" : "bg-[#f8fafc]")}></td>
                <td className={clsx("px-4 py-3 text-right", darkMode ? "bg-[#0a0a0f]" : "bg-[#f8fafc]")}>
                  <div className={clsx("text-xs font-medium", darkMode ? "text-white/60" : "text-black/60")}>
                    Total
                  </div>
                </td>
                <td className={clsx("px-4 py-3 text-right", darkMode ? "bg-[#0a0a0f]" : "bg-[#f8fafc]")}>
                  <div className="flex flex-col items-end gap-1">
                    <div className={clsx("text-sm font-bold", totals.total >= 0 ? "text-[#00FF94]" : "text-[#FF4757]")}>
                      {formatCurrency(totals.total)}
                    </div>
                    <div className={clsx("text-[10px] flex gap-2", darkMode ? "text-white/50" : "text-black/50")}>
                      <span className="text-[#00FF94]">+{formatCurrency(totals.totalEntradas)}</span>
                      <span className="text-[#FF4757]">-{formatCurrency(totals.totalSaidas)}</span>
                    </div>
                  </div>
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

export default App;
