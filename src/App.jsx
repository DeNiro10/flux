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
      return {
        tab: savedTab || 'overview',
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
    if (activeTab === 'goals') {
      loadGoals();
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
    if (!confirm('Tem certeza que deseja deletar esta meta?')) {
      return;
    }

    try {
      await api.deleteGoal(goalId);
      await loadGoals();
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
      const periodParam = filters.period && filters.period !== 'all' ? `?period=${filters.period}` : '';
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

  useEffect(() => {
    if (activeTab === 'loans') {
      loadLoans();
    }
  }, [activeTab]);

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
    <div className={clsx("min-h-screen transition-colors duration-300", theme.bg, theme.text, "selection:bg-[#00D4FF]/20")}>
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
                  className="w-32 h-32 rounded-2xl overflow-hidden relative"
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
                <div className="w-32 h-32 bg-gradient-to-br from-[#00D4FF] to-[#7B61FF] rounded-2xl flex items-center justify-center">
                  <span className="text-4xl font-bold text-white">F</span>
                </div>
              )}
              <div className="absolute -inset-0.5 bg-gradient-to-br from-[#00D4FF] to-[#7B61FF] rounded-2xl blur-sm opacity-10 -z-10"></div>
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

        {/* Navigation Tabs */}
        <div className="px-8 flex gap-1">
          {['overview', 'transactions', 'loans', 'goals', 'expected-expenses', 'analytics'].map(tab => (
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
              {tab === 'overview' ? 'Visão Geral' : tab === 'transactions' ? 'Transações' : tab === 'loans' ? 'Empréstimos' : tab === 'goals' ? 'Metas' : tab === 'expected-expenses' ? 'Gastos Previstos' : 'Análises'}
              {activeTab === tab && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#00D4FF] to-[#7B61FF]"></div>
              )}
            </button>
          ))}
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
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
              {[
                { label: 'Saldo Inicial', value: initialBalance, icon: '↗', positive: initialBalance >= 0 },
                { label: 'Entradas', value: periodIncome, icon: '+', positive: true },
                { label: 'Gastos', value: periodExpenses, icon: '−', positive: false },
                { label: 'Saldo Final', value: endOfPeriodBalance, icon: '=', positive: endOfPeriodBalance >= 0 },
                { label: 'Saldo Atual', value: bankAccountBalancePluggy || currentBankBalance, icon: '◉', positive: true, isLive: true },
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
                    <BarChart data={topCategories.slice(0, 6)} layout="vertical" cursor={false}>
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
                      <Bar dataKey="total" radius={[0, 4, 4, 0]} cursor={false}>
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
        {activeTab === 'goals' && (
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
                  <h2 className={clsx("text-xl font-semibold", theme.text)}>Metas de Gastos</h2>
                  <button
                    onClick={() => handleOpenGoalModal()}
                    className={clsx(
                      "px-4 py-2 rounded-lg font-medium transition-all",
                      "bg-[#FFB800] text-white hover:bg-[#FFB800]/80",
                      "flex items-center gap-2"
                    )}
                  >
                    <span>+</span> Adicionar Meta
                  </button>
                </div>

                {/* Goals List */}
                {goalsData.goals.length === 0 ? (
                  <div className={clsx("rounded-2xl p-12 text-center border", theme.card, theme.cardBorder)}>
                    <p className={clsx("text-lg", theme.textMuted)}>Nenhuma meta encontrada</p>
                    <button
                      onClick={() => handleOpenGoalModal()}
                      className={clsx(
                        "mt-4 px-4 py-2 rounded-lg font-medium transition-all",
                        "bg-[#FFB800] text-white hover:bg-[#FFB800]/80"
                      )}
                    >
                      Adicionar Primeira Meta
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {goalsData.goals.map((goal) => (
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
                        </div>
                      </div>
                    ))}
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
                {/* Header com botão de adicionar */}
                <div className="flex items-center justify-between mb-4">
                  <h2 className={clsx("text-xl font-semibold", theme.text)}>Gastos Previstos</h2>
                  <button
                    onClick={() => handleOpenExpectedExpenseModal()}
                    className={clsx(
                      "px-4 py-2 rounded-lg font-medium transition-all",
                      "bg-[#00D4FF] text-white hover:bg-[#00D4FF]/80",
                      "flex items-center gap-2"
                    )}
                  >
                    <span>+</span> Adicionar Gasto
                  </button>
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
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {expectedExpensesData.expenses.map((expense) => (
                      <div key={expense.id} className={clsx("rounded-2xl p-6 border relative overflow-hidden", theme.card, theme.cardBorder, "hover:scale-[1.02] transition-transform duration-200")}>
                        {/* Background gradient effect */}
                        <div className={clsx(
                          "absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-10 -z-0",
                          expense.isPaid ? "bg-[#00FF94]" : expense.isActive ? "bg-[#FFB800]" : "bg-[#64748b]"
                        )}></div>

                        {/* Header */}
                        <div className="relative z-10 flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-3">
                              {expense.isPaid ? (
                                <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-[#00FF94]/20 text-[#00FF94] border border-[#00FF94]/40 flex items-center gap-1.5">
                                  <span>✓</span> PAGO
                                </span>
                              ) : expense.isActive ? (
                                <span className="px-3 py-1.5 rounded-full text-xs font-medium bg-[#FFB800]/20 text-[#FFB800] border border-[#FFB800]/40 flex items-center gap-1.5">
                                  <span>⏳</span> PENDENTE
                                </span>
                              ) : (
                                <span className={clsx("px-3 py-1.5 rounded-full text-xs font-medium", darkMode ? "bg-white/5 text-white/70" : "bg-black/5 text-black/70")}>
                                  Encerrado
                                </span>
                              )}
                            </div>
                            <h3 className={clsx("text-xl font-bold mb-1", theme.text)}>{expense.name}</h3>
                            <p className={clsx("text-xs font-medium", theme.textMuted)}>
                              {expense.paymentMethod}
                            </p>
                          </div>
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => handleOpenExpectedExpenseModal(expense)}
                              className={clsx(
                                "px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all",
                                "bg-[#7B61FF]/20 text-[#7B61FF] hover:bg-[#7B61FF]/30 border border-[#7B61FF]/30"
                              )}
                              title="Editar"
                            >
                              ✎
                            </button>
                            <button
                              onClick={() => handleDeleteExpectedExpense(expense.id)}
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
                        <div className="mb-4 relative z-10">
                          <div className="flex items-baseline gap-2 mb-1">
                            <span className={clsx("text-2xl font-bold", expense.isPaid ? "text-[#00FF94]" : "text-[#FFB800]", theme.text)}>
                              {formatCurrency(expense.amount)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className={clsx("text-xs font-medium", theme.textMuted)}>
                              Data de encerramento: {expense.endDateLabel}
                            </span>
                          </div>
                        </div>

                        {/* Payment Info */}
                        {expense.isPaid && expense.lastPaymentDate && (
                          <div className="mb-4 pt-4 border-t" style={{ borderColor: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}>
                            <p className={clsx("text-xs font-medium mb-1", theme.textMuted)}>Último pagamento</p>
                            <p className={clsx("text-sm font-semibold", theme.text)}>
                              {formatDate(expense.lastPaymentDate)} - {formatCurrency(expense.lastPaymentAmount)}
                            </p>
                          </div>
                        )}

                        {/* Matching Transactions */}
                        {expense.matchingTransactions && expense.matchingTransactions.length > 0 && (
                          <details className="relative z-10 mt-4">
                            <summary className={clsx(
                              "cursor-pointer text-xs font-medium py-2 px-3 rounded-lg transition-all",
                              darkMode ? "bg-white/5 hover:bg-white/10" : "bg-black/5 hover:bg-black/10",
                              theme.textMuted
                            )}>
                              <span>Transações Encontradas ({expense.matchingTransactions.length})</span>
                              <span className="text-xs ml-2">▼</span>
                            </summary>
                            <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
                              {expense.matchingTransactions.map((tx) => (
                                <div key={tx.id} className={clsx("p-2 rounded text-xs", darkMode ? "bg-white/5" : "bg-black/5")}>
                                  <div className="flex justify-between items-start mb-1">
                                    <span className={clsx("font-medium", theme.text)}>{formatDate(tx.date)}</span>
                                    <span className={clsx("font-semibold", theme.text)}>{formatCurrency(Math.abs(tx.amount))}</span>
                                  </div>
                                  <p className={clsx("text-xs", theme.textMuted)}>{tx.description}</p>
                                  <div className="flex gap-2 mt-1">
                                    <span className={clsx("text-xs", theme.textMuted)}>{tx.category}</span>
                                    {tx.bankName && <span className={clsx("text-xs", theme.textMuted)}>• {tx.bankName}</span>}
                                    {tx.ownerName && <span className={clsx("text-xs", theme.textMuted)}>• {tx.ownerName}</span>}
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

        {/* Analytics Tab */}
        {dashboardData && activeTab === 'analytics' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* All Categories */}
            <div className={clsx("rounded-2xl p-6 border", theme.card, theme.cardBorder)}>
              <h3 className={clsx("text-sm font-medium uppercase tracking-wider mb-6", darkMode ? "text-white/80" : "text-black/80")}>Todas as Categorias</h3>
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {dashboardData.categoryTotals.map((cat, idx) => (
                  <div key={idx} className="flex items-center gap-4">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}></div>
                    <div className="flex-1">
                      <div className="flex justify-between items-center mb-1">
                        <span className={clsx("text-sm", theme.text)}>{cat.category}</span>
                        <span className={clsx("text-sm font-medium", theme.text)}>{formatCurrency(cat.total)}</span>
                      </div>
                      <div className={clsx("h-1.5 rounded-full overflow-hidden", darkMode ? "bg-white/5" : "bg-black/5")}>
                        <div 
                          className="h-full rounded-full transition-all duration-500"
                          style={{ 
                            width: `${(cat.total / dashboardData.categoryTotals[0].total * 100)}%`,
                            backgroundColor: CHART_COLORS[idx % CHART_COLORS.length]
                          }}
                        ></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Summary Stats */}
            <div className="space-y-4">
              <div className="bg-gradient-to-br from-[#00D4FF]/10 to-transparent border border-[#00D4FF]/20 rounded-2xl p-6">
                <h3 className="text-xs text-[#00D4FF] uppercase tracking-wider mb-2">Total Entradas</h3>
                <p className={clsx("text-3xl font-bold", theme.text)}>{formatCurrency(periodIncome)}</p>
              </div>
              <div className="bg-gradient-to-br from-[#FF4757]/10 to-transparent border border-[#FF4757]/20 rounded-2xl p-6">
                <h3 className="text-xs text-[#FF4757] uppercase tracking-wider mb-2">Total Gastos</h3>
                <p className={clsx("text-3xl font-bold", theme.text)}>{formatCurrency(periodExpenses)}</p>
              </div>
              <div className="bg-gradient-to-br from-[#7B61FF]/10 to-transparent border border-[#7B61FF]/20 rounded-2xl p-6">
                <h3 className="text-xs text-[#7B61FF] uppercase tracking-wider mb-2">Balanço</h3>
                <p className={clsx(
                  "text-3xl font-bold",
                  periodMovement >= 0 ? "text-[#00FF94]" : "text-[#FF4757]"
                )}>
                  {formatCurrency(periodMovement)}
                </p>
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
  
  // Comparar com TODAS as faturas anteriores que correspondem a este cartão
  // Verificar se o valor da entrada corresponde a alguma fatura anterior
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
          } else {
            // Se não tem data mas o valor corresponde, assumir que é fatura anterior
            return true;
          }
        }
        
        // Se a fatura está aberta mas o valor corresponde exatamente
        // Verificar se a data da transação é anterior à data de vencimento
        if (bill.isOpen === true && bill.dueDate) {
          const dueDate = new Date(bill.dueDate);
          // Se pagou antes do vencimento, é pagamento de fatura anterior
          if (txDate < dueDate) {
            return true;
          }
        }
      }
    }
  }
  
  return false;
}

// Transaction Table Component
function TransactionTable({ transactions, title, formatCurrency, formatDate, editingCategory, setEditingCategory, newCategory, setNewCategory, handleUpdateCategory, theme = {}, darkMode = true, creditCardBills = [] }) {
  // Calcular totais, excluindo pagamentos de faturas anteriores
  const totals = useMemo(() => {
    // Filtrar transações que devem ser ignoradas no resumo
    const filteredTransactions = transactions.filter(tx => !shouldIgnorePayment(tx, transactions, creditCardBills));
    
    const entradas = filteredTransactions.filter(tx => tx.amount > 0);
    const saidas = filteredTransactions.filter(tx => tx.amount < 0);
    const totalEntradas = entradas.reduce((sum, tx) => sum + tx.amount, 0);
    const totalSaidas = saidas.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
    
    // Calcular total: entradas - saídas
    const total = totalEntradas - totalSaidas;
    
    // Contar também as transações ignoradas para informação
    const ignoredPayments = transactions.filter(tx => shouldIgnorePayment(tx, transactions, creditCardBills));
    
    return {
      numEntradas: entradas.length,
      numSaidas: saidas.length,
      totalEntradas,
      totalSaidas,
      total,
      ignoredCount: ignoredPayments.length,
      ignoredAmount: ignoredPayments.reduce((sum, tx) => sum + tx.amount, 0)
    };
  }, [transactions, creditCardBills]);

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
