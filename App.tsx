import React, { useState, useMemo, useEffect } from 'react';
import { Product, CartItem, Page, CustomRosary, ProductVariant, RosaryOption } from './types';
import { 
  PRODUCTS as INITIAL_PRODUCTS, 
  CATEGORIES, 
  ROSARY_MATERIALS as INITIAL_MATERIALS,
  ROSARY_COLORS as INITIAL_COLORS,
  ROSARY_CRUCIFIXES as INITIAL_CRUCIFIXES
} from './constants';
import { supabase } from './supabaseClient';
import { Session } from '@supabase/supabase-js';
import emailjs from '@emailjs/browser';

const ITEMS_PER_PAGE = 8;
const ADMIN_ITEMS_PER_PAGE = 5; // Paginação específica do Admin
const WHATSAPP_NUMBER = "5575992257902"; 

// --- CONFIGURAÇÃO DE E-MAIL (EmailJS) ---
const EMAIL_CONFIG = {
  SERVICE_ID: "Minha santa fonte", 
  TEMPLATE_ID: "template_jf47pls", 
  PUBLIC_KEY: "VA3a0JkCjqXQUIec1"
};

// LISTA DE E-MAILS PARA NOTIFICAÇÃO
const NOTIFICATION_EMAILS = [
  "wevelleytwich@gmail.com",
  "wevelleyjoga@gmail.com"
];

// Interface para Vendas/Produção
interface SaleEntry {
  id: string;
  date: string;
  description: string;
  value: number;
  status: 'pending' | 'in_progress' | 'done';
}

const App: React.FC = () => {
  // --- Estados de Navegação e Autenticação ---
  const [currentPage, setCurrentPage] = useState<Page>(Page.Home);
  const [session, setSession] = useState<Session | null>(null); // Estado da Sessão Supabase
  const [isAdmin, setIsAdmin] = useState(false); // Derivado da sessão
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [adminTab, setAdminTab] = useState<'products' | 'stock' | 'customizer' | 'balance' | 'production'>('products');
  const [loadingAuth, setLoadingAuth] = useState(true);

  // --- Estados de Dados ---
  const [products, setProducts] = useState<Product[]>([]);
  const [materials, setMaterials] = useState<RosaryOption[]>([]);
  const [colors, setColors] = useState<RosaryOption[]>([]);
  const [crucifixes, setCrucifixes] = useState<RosaryOption[]>([]);
  const [baseRosaryPrice, setBaseRosaryPrice] = useState<number>(40.00);
  
  // Estado para o Balanço Financeiro e Produção
  const [salesHistory, setSalesHistory] = useState<SaleEntry[]>([]);
  const [newSale, setNewSale] = useState({ description: '', value: '' });

  // --- Estados do Catálogo (Filtros e Busca) ---
  const [selectedCategory, setSelectedCategory] = useState<string>("Todos");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<string>("recent");
  const [catalogPage, setCatalogPage] = useState(1);

  // --- Estados da Tabela Admin (NOVO) ---
  const [adminSearchTerm, setAdminSearchTerm] = useState("");
  const [adminProductPage, setAdminProductPage] = useState(1);

  // --- CARRINHO COM PERSISTÊNCIA (LOCALSTORAGE) ---
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const savedCart = localStorage.getItem('msf_cart');
      return savedCart ? JSON.parse(savedCart) : [];
    } catch (error) {
      console.error("Erro ao carregar carrinho:", error);
      return [];
    }
  });

  // Salvar carrinho sempre que houver alteração
  useEffect(() => {
    localStorage.setItem('msf_cart', JSON.stringify(cart));
  }, [cart]);

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [copyFeedback, setCopyFeedback] = useState(false);

  // --- Estados do Customizador ---
  const [customStep, setCustomStep] = useState(1);
  const [customSelections, setCustomSelections] = useState<CustomRosary>({});

  // --- Estados de Formulário Admin ---
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [newProduct, setNewProduct] = useState<Partial<Product>>({
    name: '',
    category: CATEGORIES[1],
    price: 0,
    stock: 10,
    description: '',
    images: [],
    variants: [],
    isFeatured: false
  });
  
  const [editingCustomOption, setEditingCustomOption] = useState<{type: 'material' | 'color' | 'crucifix' | '', option: RosaryOption | null}>({type: '', option: null});
  const [tempCustomOption, setTempCustomOption] = useState<Partial<RosaryOption>>({ name: '', price: 0, image: '' });

  const [tempImageUrl, setTempImageUrl] = useState("");
  const [tempVariantName, setTempVariantName] = useState("");
  const [tempVariantPrice, setTempVariantPrice] = useState<number>(0);
  const [tempVariantImage, setTempVariantImage] = useState("");
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  // --- LÓGICA DE SEO DINÂMICO ---
  const updateSEO = (title: string, description: string) => {
    document.title = `${title} | Minha Santa Fonte`;
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.setAttribute('name', 'description');
      document.head.appendChild(metaDesc);
    }
    metaDesc.setAttribute('content', description);
    
    let ogTitle = document.querySelector('meta[property="og:title"]');
    if(ogTitle) ogTitle.setAttribute('content', `${title} | Minha Santa Fonte`);
    
    let ogDesc = document.querySelector('meta[property="og:description"]');
    if(ogDesc) ogDesc.setAttribute('content', description);
  };

  useEffect(() => {
    switch (currentPage) {
      case Page.Home:
        updateSEO("Artigos Religiosos e Fé", "Loja de artigos religiosos católicos: terços personalizados, bíblias, imagens sacras e decoração. Encontre paz e tradição para seu lar.");
        break;
      case Page.Catalog:
        updateSEO("Catálogo de Produtos", "Explore nossa coleção completa de artigos sacros. Imagens, terços, velas e presentes católicos selecionados com devoção.");
        break;
      case Page.Customizer:
        updateSEO("Monte seu Terço Personalizado", "Crie um terço único e exclusivo no Ateliê Minha Santa Fonte. Escolha as contas, cores e o crucifixo para sua devoção.");
        break;
      case Page.About:
        updateSEO("Nossa História de Fé", "Conheça a história da Minha Santa Fonte. Nossa missão é levar o sagrado para os lares através de artigos religiosos de qualidade.");
        break;
      case Page.Product:
        if (selectedProduct) {
          updateSEO(selectedProduct.name, `Compre ${selectedProduct.name}. ${selectedProduct.description.substring(0, 150)}... Artigos religiosos de alta qualidade.`);
        }
        break;
      case Page.AdminDashboard:
        document.title = "Admin | Minha Santa Fonte";
        break;
      default:
        updateSEO("Minha Santa Fonte", "Artigos Religiosos");
    }
  }, [currentPage, selectedProduct]);

  // --- Inicialização e Autenticação ---
  useEffect(() => {
    try {
      emailjs.init({
        publicKey: EMAIL_CONFIG.PUBLIC_KEY,
      });
    } catch (e) {
      console.error("Erro ao inicializar EmailJS:", e);
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsAdmin(!!session);
      setLoadingAuth(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setIsAdmin(!!session);
      if (!session && currentPage === Page.AdminDashboard) {
        setCurrentPage(Page.Home);
      }
    });

    return () => subscription.unsubscribe();
  }, [currentPage]);

  const fetchData = async () => {
    const { data: productsData } = await supabase.from('products').select('*').order('createdAt', { ascending: false });
    if (productsData && productsData.length > 0) {
      setProducts(productsData);
    } else {
      setProducts(INITIAL_PRODUCTS.map(p => ({ ...p, images: p.images || [p.image], createdAt: Date.now() })));
    }

    const { data: salesData } = await supabase.from('sales').select('*').order('id', { ascending: false });
    if (salesData) {
      const formattedSales = salesData.map((s: any) => ({
        ...s,
        status: s.status || 'pending'
      }));
      setSalesHistory(formattedSales);
    }

    const { data: optionsData } = await supabase.from('custom_options').select('*');
    if (optionsData) {
      setMaterials(optionsData.filter((o: any) => o.type === 'material'));
      setColors(optionsData.filter((o: any) => o.type === 'color'));
      setCrucifixes(optionsData.filter((o: any) => o.type === 'crucifix'));
    } else {
      setMaterials(INITIAL_MATERIALS);
      setColors(INITIAL_COLORS);
      setCrucifixes(INITIAL_CRUCIFIXES);
    }

    const { data: configData } = await supabase.from('config').select('value').eq('key', 'base_rosary_price').single();
    if (configData) setBaseRosaryPrice(Number(configData.value));
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- Cálculos de Paginação do Admin ---
  const filteredAdminProducts = useMemo(() => {
    let list = [...products];
    if (adminSearchTerm.trim()) {
      const term = adminSearchTerm.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(term) || p.category.toLowerCase().includes(term));
    }
    return list;
  }, [products, adminSearchTerm]);

  const totalAdminPages = Math.ceil(filteredAdminProducts.length / ADMIN_ITEMS_PER_PAGE);
  const paginatedAdminProducts = useMemo(() => {
    const startIndex = (adminProductPage - 1) * ADMIN_ITEMS_PER_PAGE;
    return filteredAdminProducts.slice(startIndex, startIndex + ADMIN_ITEMS_PER_PAGE);
  }, [filteredAdminProducts, adminProductPage]);

  // Resetar página quando muda a busca
  useEffect(() => {
    setAdminProductPage(1);
  }, [adminSearchTerm]);

  const handleAdminLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoginError("");
    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setLoginError("Acesso negado: " + error.message);
    } else {
      setCurrentPage(Page.AdminDashboard);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsAdmin(false);
    setCurrentPage(Page.Home);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProduct.images || newProduct.images.length === 0) {
      alert("Por favor, adicione pelo menos uma imagem.");
      return;
    }

    const productData = {
      ...newProduct,
      price: Number(newProduct.price),
      stock: Number(newProduct.stock),
      image: newProduct.images[0]
    };

    let updatedList = [...products];
    let productToSave: Product;

    if (editingProduct) {
      productToSave = { ...editingProduct, ...productData } as Product;
      updatedList = products.map(p => p.id === editingProduct.id ? productToSave : p);
    } else {
      productToSave = { 
        ...productData as Product,
        id: "prod-" + Date.now(), 
        createdAt: Date.now() 
      };
      updatedList = [productToSave, ...products];
    }

    const { error } = await supabase.from('products').upsert(productToSave);

    if (error) {
      alert("Erro ao salvar produto: " + error.message);
      return;
    }

    setProducts(updatedList);
    setEditingProduct(null);
    setNewProduct({ name: '', category: CATEGORIES[1], price: 0, stock: 10, description: '', images: [], variants: [], isFeatured: false });
  };

  const deleteProduct = async (id: string) => {
    if (window.confirm("Tem certeza que deseja remover este produto? Essa ação não pode ser desfeita.")) {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (!error) {
        setProducts(products.filter(p => p.id !== id));
      } else {
        alert("Erro ao deletar: " + error.message);
      }
    }
  };

  const updateStock = async (id: string, delta: number) => {
    const product = products.find(p => p.id === id);
    if (!product) return;
    const newStock = Math.max(0, product.stock + delta);
    setProducts(products.map(p => p.id === id ? { ...p, stock: newStock } : p));
    await supabase.from('products').update({ stock: newStock }).eq('id', id);
  };

  const addVariantToProduct = () => {
    if (!tempVariantName) return;
    const variant: ProductVariant = {
      name: tempVariantName,
      priceDelta: Number(tempVariantPrice),
      image: tempVariantImage
    };
    setNewProduct(prev => ({
      ...prev,
      variants: [...(prev.variants || []), variant]
    }));
    setTempVariantName("");
    setTempVariantPrice(0);
    setTempVariantImage("");
  };

  const removeVariantFromProduct = (index: number) => {
    setNewProduct(prev => ({
      ...prev,
      variants: prev.variants?.filter((_, i) => i !== index)
    }));
  };

  const saveCustomOptions = async (type: 'material' | 'color' | 'crucifix', newOption: RosaryOption) => {
    const payload = { ...newOption, type };
    const { error } = await supabase.from('custom_options').upsert(payload);
    if (error) { alert('Erro ao salvar opção: ' + error.message); return; }
    if (type === 'material') {
      const exists = materials.find(m => m.id === newOption.id);
      setMaterials(exists ? materials.map(m => m.id === newOption.id ? newOption : m) : [...materials, newOption]);
    }
    if (type === 'color') {
      const exists = colors.find(c => c.id === newOption.id);
      setColors(exists ? colors.map(c => c.id === newOption.id ? newOption : c) : [...colors, newOption]);
    }
    if (type === 'crucifix') {
      const exists = crucifixes.find(x => x.id === newOption.id);
      setCrucifixes(exists ? crucifixes.map(x => x.id === newOption.id ? newOption : x) : [...crucifixes, newOption]);
    }
  };

  const handleSaveCustomOption = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomOption.type) return;
    const type = editingCustomOption.type as 'material' | 'color' | 'crucifix';
    const newOpt: RosaryOption = { 
      id: editingCustomOption.option?.id || `opt-${Date.now()}`, 
      name: tempCustomOption.name || 'Nova Opção', 
      price: Number(tempCustomOption.price) || 0, 
      image: tempCustomOption.image 
    };
    await saveCustomOptions(type, newOpt);
    setEditingCustomOption({ type: '', option: null });
    setTempCustomOption({ name: '', price: 0, image: '' });
  };
  
  const deleteCustomOption = async (type: 'material' | 'color' | 'crucifix', id: string) => {
    if (window.confirm("Remover esta opção?")) {
      await supabase.from('custom_options').delete().eq('id', id);
      if (type === 'material') setMaterials(materials.filter(m => m.id !== id));
      if (type === 'color') setColors(colors.filter(c => c.id !== id));
      if (type === 'crucifix') setCrucifixes(crucifixes.filter(x => x.id !== id));
    }
  };

  const saveBasePrice = async (val: number) => {
    setBaseRosaryPrice(val);
    await supabase.from('config').upsert({ key: 'base_rosary_price', value: val.toString() });
  };

  const sendProductionNotification = async (sale: SaleEntry) => {
    try {
      const recipients = NOTIFICATION_EMAILS.join(',');
      const templateParams = {
        description: sale.description,
        value: sale.value.toFixed(2),
        date: sale.date,
        to_name: "Equipe Minha Santa Fonte",
        to_email: recipients
      };

      const result = await emailjs.send(
        EMAIL_CONFIG.SERVICE_ID,
        EMAIL_CONFIG.TEMPLATE_ID,
        templateParams,
        { publicKey: EMAIL_CONFIG.PUBLIC_KEY }
      );
      
      console.log("E-mail enviado com sucesso:", result.text);
      alert(`Pedido Salvo e E-mail Enviado! (ID: ${result.status})`);
      
    } catch (error: any) {
      console.error("Erro detalhado do EmailJS:", error);
      let errorMessage = "Erro desconhecido.";
      if (error && typeof error === 'object') {
          errorMessage = error.text || error.message || JSON.stringify(error);
      } else if (typeof error === 'string') {
          errorMessage = error;
      }
      alert(`⚠️ O pedido foi salvo, mas o e-mail NÃO foi enviado.\n\nErro do Servidor: ${errorMessage}\n\nDICAS PARA CORRIGIR:\n1. Se o erro for "The service ID is invalid", verifique se o ID é realmente "${EMAIL_CONFIG.SERVICE_ID}".\n2. Se usar AdBlock, desative-o.`);
    }
  };

  const handleAddSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSale.description) return; 
    
    const entry: SaleEntry = {
      id: `sale-${Date.now()}`,
      date: new Date().toLocaleDateString('pt-BR'),
      description: newSale.description,
      value: Number(newSale.value) || 0,
      status: 'pending'
    };
    
    const { error } = await supabase.from('sales').insert(entry);
    
    if (error) {
      alert("Erro ao lançar venda: " + error.message);
      return;
    }
    
    setSalesHistory([entry, ...salesHistory]);
    setNewSale({ description: '', value: '' });
    await sendProductionNotification(entry);
  };

  const updateSaleStatus = async (id: string, newStatus: 'pending' | 'in_progress' | 'done') => {
    const { error } = await supabase.from('sales').update({ status: newStatus }).eq('id', id);
    if (!error) {
       setSalesHistory(salesHistory.map(s => s.id === id ? { ...s, status: newStatus } : s));
    }
  };

  const deleteSale = async (id: string) => {
    if (window.confirm("Deseja realmente apagar este pedido da produção/histórico?")) {
      const { error } = await supabase.from('sales').delete().eq('id', id);
      if (!error) {
        setSalesHistory(salesHistory.filter(s => s.id !== id));
      } else {
        alert("Erro ao remover: " + error.message);
      }
    }
  };

  const addToCart = (product: Product) => {
    if (product.stock <= 0) {
      alert("Desculpe, este produto está temporariamente esgotado.");
      return;
    }
    const finalPrice = product.price + (selectedVariant?.priceDelta || 0);
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id && item.selectedVariant?.name === selectedVariant?.name);
      if (existing) {
        return prev.map(item => (item.id === product.id && item.selectedVariant?.name === selectedVariant?.name) ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { ...product, price: finalPrice, quantity: 1, selectedVariant: selectedVariant || undefined }];
    });
    setIsCartOpen(true);
  };

  const calculateCustomPrice = () => {
    let total = baseRosaryPrice;
    if (customSelections.material) total += customSelections.material.price;
    if (customSelections.color) total += customSelections.color.price;
    if (customSelections.crucifix) total += customSelections.crucifix.price