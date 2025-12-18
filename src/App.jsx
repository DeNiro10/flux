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
  const [activeTab, setActiveTab] = useState('overview');
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
  
  const [filters, setFilters] = useState({
    period: getCurrentPeriod(),
    accountType: 'all',
    bankName: 'all',
    ownerName: 'all',
    category: 'all',
  });

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
          {['overview', 'transactions', 'loans', 'analytics'].map(tab => (
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
              {tab === 'overview' ? 'Visão Geral' : tab === 'transactions' ? 'Transações' : tab === 'loans' ? 'Empréstimos' : 'Análises'}
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
                    <BarChart data={topCategories.slice(0, 6)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis type="number" tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
                      <YAxis type="category" dataKey="category" tick={{ fill: '#64748b', fontSize: 11 }} width={100} />
                      <Tooltip 
                        formatter={(value) => formatCurrency(value)}
                        contentStyle={{ 
                          backgroundColor: '#1a1a2e', 
                          border: '1px solid rgba(255,255,255,0.1)', 
                          borderRadius: '12px' 
                        }}
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
                <TransactionTable transactions={bankTransactions} title="Conta Corrente" formatCurrency={formatCurrency} formatDate={formatDate} editingCategory={editingCategory} setEditingCategory={setEditingCategory} newCategory={newCategory} setNewCategory={setNewCategory} handleUpdateCategory={handleUpdateCategory} theme={theme} darkMode={darkMode} />
                <TransactionTable transactions={creditCardTransactions} title="Cartão de Crédito" formatCurrency={formatCurrency} formatDate={formatDate} editingCategory={editingCategory} setEditingCategory={setEditingCategory} newCategory={newCategory} setNewCategory={setNewCategory} handleUpdateCategory={handleUpdateCategory} theme={theme} darkMode={darkMode} />
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

                {/* Loans List */}
                {loansData.loans.length === 0 ? (
                  <div className={clsx("rounded-2xl p-12 text-center border", theme.card, theme.cardBorder)}>
                    <p className={clsx("text-lg", theme.textMuted)}>Nenhum empréstimo encontrado</p>
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
                          <div className="text-right">
                            <p className={clsx("text-2xl font-bold mb-1", theme.text)}>{formatCurrency(loan.totalAmount)}</p>
                            <p className={clsx("text-xs", theme.textMuted)}>Valor Total</p>
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
                            <p className={clsx("text-lg font-semibold text-[#FF4757]", theme.text)}>{formatCurrency(loan.remainingAmount)}</p>
                          </div>
                          <div>
                            <p className={clsx("text-xs uppercase tracking-wider mb-1", theme.textMuted)}>Parcelas Restantes</p>
                            <p className={clsx("text-lg font-semibold", theme.text)}>{loan.totalInstallments - loan.paidInstallments}</p>
                          </div>
                        </div>

                        {/* Transactions List (Collapsible) */}
                        {loan.transactions.length > 0 && (
                          <details className="mt-4">
                            <summary className={clsx("cursor-pointer text-sm font-medium mb-2", theme.textMuted, "hover:" + (darkMode ? "text-white" : "text-black"))}>
                              Ver {loan.transactions.length} transação(ões)
                            </summary>
                            <div className="mt-3 space-y-2">
                              {loan.transactions.map((tx) => (
                                <div key={tx.id} className={clsx("flex items-center justify-between p-3 rounded-lg", darkMode ? "bg-white/5" : "bg-black/5")}>
                                  <div>
                                    <p className={clsx("text-sm", theme.text)}>{formatDate(tx.date)}</p>
                                    <p className={clsx("text-xs", theme.textMuted)}>{tx.description}</p>
                                  </div>
                                  <p className={clsx("text-sm font-medium text-[#FF4757]", theme.text)}>{formatCurrency(tx.amount)}</p>
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
    </div>
  );
}

// Transaction Table Component
function TransactionTable({ transactions, title, formatCurrency, formatDate, editingCategory, setEditingCategory, newCategory, setNewCategory, handleUpdateCategory, theme = {}, darkMode = true }) {
  return (
    <div className={clsx("rounded-2xl overflow-hidden border", theme.card || "bg-white/[0.02]", theme.cardBorder || "border-white/5")}>
      <div className={clsx("px-6 py-4 border-b flex items-center justify-between", theme.border || "border-white/5")}>
        <h3 className={clsx("text-sm font-medium uppercase tracking-wider", darkMode ? "text-white/80" : "text-black/80")}>{title}</h3>
        <span className="text-xs text-[#64748b]">{transactions.length} transações</span>
      </div>
      <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
        <table className="w-full">
          <thead className={clsx("sticky top-0", theme.card || "bg-white/[0.02]")}>
            <tr>
              <th className="px-4 py-3 text-left text-[10px] font-medium text-[#64748b] uppercase tracking-wider">Data</th>
              <th className="px-4 py-3 text-left text-[10px] font-medium text-[#64748b] uppercase tracking-wider">Banco</th>
              <th className="px-4 py-3 text-left text-[10px] font-medium text-[#64748b] uppercase tracking-wider">Pessoa</th>
              <th className="px-4 py-3 text-left text-[10px] font-medium text-[#64748b] uppercase tracking-wider">Descrição</th>
              <th className="px-4 py-3 text-left text-[10px] font-medium text-[#64748b] uppercase tracking-wider">Categoria</th>
              <th className="px-4 py-3 text-right text-[10px] font-medium text-[#64748b] uppercase tracking-wider">Valor</th>
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
        </table>
      </div>
    </div>
  );
}

export default App;
