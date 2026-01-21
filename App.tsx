
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
const WHATSAPP_NUMBER = "5575992257902"; 

// --- CONFIGURAÇÃO DE E-MAIL (EmailJS) ---
// Credenciais fornecidas para notificação de produção
const EMAIL_CONFIG = {
  SERVICE_ID: "Minha santa fonte", // ID do Serviço (Verifique se é o ID exato, ex: service_xxx)
  TEMPLATE_ID: "template_jf47pls", // ID do Template
  PUBLIC_KEY: "VA3a0JkCjqXQUIec1"  // Chave Pública
};

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

  const [cart, setCart] = useState<CartItem[]>([]);
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
    // Verificar sessão ativa ao carregar
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsAdmin(!!session);
      setLoadingAuth(false);
    });

    // Escutar mudanças na autenticação (Login/Logout)
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
    // 1. Produtos
    const { data: productsData } = await supabase.from('products').select('*').order('createdAt', { ascending: false });
    if (productsData && productsData.length > 0) {
      setProducts(productsData);
    } else {
      setProducts(INITIAL_PRODUCTS.map(p => ({ ...p, images: p.images || [p.image], createdAt: Date.now() })));
    }

    // 2. Vendas
    const { data: salesData } = await supabase.from('sales').select('*').order('id', { ascending: false });
    if (salesData) {
      const formattedSales = salesData.map((s: any) => ({
        ...s,
        status: s.status || 'pending'
      }));
      setSalesHistory(formattedSales);
    }

    // 3. Opções
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

    // 4. Config
    const { data: configData } = await supabase.from('config').select('value').eq('key', 'base_rosary_price').single();
    if (configData) setBaseRosaryPrice(Number(configData.value));
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- Lógica de Login/Logout Seguro ---
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
      // O useEffect onAuthStateChange vai lidar com o redirecionamento e estado
      setCurrentPage(Page.AdminDashboard);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsAdmin(false);
    setCurrentPage(Page.Home);
  };

  // --- Funções Auxiliares de Banco de Dados ---
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

  // --- Funções de Variantes ---
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

  // --- Funções do Ateliê ---
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

  // --- Função para Enviar Notificação por E-mail ---
  const sendProductionNotification = async (sale: SaleEntry) => {
    try {
      await emailjs.send(
        EMAIL_CONFIG.SERVICE_ID,
        EMAIL_CONFIG.TEMPLATE_ID,
        {
          description: sale.description, // Variável {{description}} no template
          value: sale.value.toFixed(2),  // Variável {{value}} no template
          date: sale.date,               // Variável {{date}} no template
          to_name: "Equipe Minha Santa Fonte"
        },
        EMAIL_CONFIG.PUBLIC_KEY
      );
      console.log("E-mail de notificação enviado com sucesso!");
    } catch (error) {
      console.error("Erro ao enviar e-mail de notificação:", error);
      alert("O pedido foi salvo, mas houve um erro ao enviar a notificação por e-mail. Verifique as credenciais no console.");
    }
  };

  // --- Funções Financeiras/Produção ---
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

    // Enviar notificação por e-mail com os detalhes do pedido
    await sendProductionNotification(entry);
  };

  const updateSaleStatus = async (id: string, newStatus: 'pending' | 'in_progress' | 'done') => {
    const { error } = await supabase.from('sales').update({ status: newStatus }).eq('id', id);
    if (!error) {
       setSalesHistory(salesHistory.map(s => s.id === id ? { ...s, status: newStatus } : s));
    }
  };

  const deleteSale = async (id: string) => {
    if (window.confirm("Deseja remover este registro?")) {
      const { error } = await supabase.from('sales').delete().eq('id', id);
      if (!error) {
        setSalesHistory(salesHistory.filter(s => s.id !== id));
      }
    }
  };

  // --- Funções Carrinho ---
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
    if (customSelections.crucifix) total += customSelections.crucifix.price;
    return total;
  };

  const addCustomToCart = () => {
    const finalPrice = calculateCustomPrice();
    const customItem: CartItem = {
      id: "custom-" + Date.now(),
      name: "Terço Personalizado Único",
      category: "Terços",
      price: finalPrice,
      description: `Material: ${customSelections.material?.name || 'Não selecionado'}, Cor: ${customSelections.color?.name || 'Padrão'}, Crucifixo: ${customSelections.crucifix?.name || 'Clássico'}`,
      image: customSelections.material?.image || materials[0]?.image || "",
      quantity: 1,
      stock: 1,
      isCustom: true,
      customDetails: { ...customSelections }
    };
    setCart(prev => [...prev, customItem]);
    setIsCartOpen(true);
    setCurrentPage(Page.Catalog);
    setCustomSelections({});
    setCustomStep(1);
  };

  const removeFromCart = (id: string, variantName?: string) => {
    setCart(prev => prev.filter(item => !(item.id === id && item.selectedVariant?.name === variantName)));
  };

  const addImageUrlToProduct = () => { 
    if (tempImageUrl.trim()) { 
      setNewProduct(p => ({ ...p, images: [...(p.images || []), tempImageUrl.trim()] })); 
      setTempImageUrl(""); 
    } 
  };

  const removeImageFromProduct = (index: number) => {
    setNewProduct(p => ({
      ...p,
      images: p.images?.filter((_, i) => i !== index)
    }));
  };

  const cartTotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const cartCount = cart.reduce((acc, item) => acc + item.quantity, 0);
  
  // --- Lógica Filtragem ---
  const filteredProducts = useMemo(() => {
    let list = [...products];
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(term) || p.description.toLowerCase().includes(term));
    }
    if (selectedCategory !== "Todos") {
      list = list.filter(p => p.category === selectedCategory);
    }
    list.sort((a, b) => {
      if (sortBy === "price_asc") return a.price - b.price;
      if (sortBy === "price_desc") return b.price - a.price;
      if (sortBy === "recent") return (b.createdAt || 0) - (a.createdAt || 0);
      return 0;
    });
    return list;
  }, [selectedCategory, products, searchTerm, sortBy]);

  const totalCatalogPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);
  const paginatedProducts = useMemo(() => {
    const startIndex = (catalogPage - 1) * ITEMS_PER_PAGE;
    return filteredProducts.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredProducts, catalogPage]);

  useEffect(() => {
    setCatalogPage(1);
  }, [selectedCategory, searchTerm, sortBy]);

  const navigateToProduct = (product: Product) => { 
    setSelectedProduct(product); 
    setSelectedVariant(null); 
    setActiveImageIndex(0); 
    setCurrentPage(Page.Product); 
    setIsMenuOpen(false); 
    window.scrollTo({ top: 0, behavior: 'smooth' }); 
  };
  
  const navigateToPage = (page: Page) => { 
    setCurrentPage(page); 
    setIsMenuOpen(false); 
    window.scrollTo({ top: 0, behavior: 'smooth' }); 
  };

  const copyProductLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    });
  };

  const handleCheckoutWhatsApp = () => {
    if (cart.length === 0) return;
    let message = "🙏 *Novo Pedido - Minha Santa Fonte* 🙏\n\n";
    message += "Olá! Gostaria de encomendar os seguintes artigos religiosos:\n\n";
    cart.forEach((item, index) => {
      message += `*${index + 1}. ${item.name}*\n`;
      if (item.selectedVariant) {
        message += `   • Opção: _${item.selectedVariant.name}_\n`;
      }
      if (item.isCustom && item.customDetails) {
        message += `   • Material: _${item.customDetails.material?.name || 'Nobre'}_\n`;
        message += `   • Cor: _${item.customDetails.color?.name || 'Padrão'}_\n`;
        message += `   • Crucifixo: _${item.customDetails.crucifix?.name || 'Clássico'}_\n`;
      }
      message += `   • Qtd: ${item.quantity}\n`;
      message += `   • Subtotal: R$ ${(item.quantity * item.price).toFixed(2)}\n\n`;
    });
    message += `----------------------------\n`;
    message += `💰 *Total do Pedido: R$ ${cartTotal.toFixed(2)}*\n`;
    message += `----------------------------\n\n`;
    message += "Por favor, me informe os próximos passos para pagamento e entrega. Amém! ✨";
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank');
  };

  // --- Ícones ---
  const IconCross = () => <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M11 2h2v7h7v2h-7v11h-2v-11h-7v-2h7v-7z" /></svg>;
  const IconCart = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>;
  const IconMenu = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16m-7 6h7" /></svg>;
  const IconX = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>;
  const IconPlus = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>;
  const IconTrash = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>;
  const IconSearch = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>;
  const IconEdit = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>;
  const IconWhatsApp = ({ size = "w-8 h-8" }: { size?: string }) => <svg className={`${size} text-white`} fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.72.94 3.675 1.438 5.662 1.439h.005c6.552 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>;
  const IconFacebook = () => <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>;
  const IconTwitter = () => <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>;
  const IconLink = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>;

  if (loadingAuth) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div></div>;
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 selection:bg-amber-100 selection:text-amber-900 transition-colors duration-300">
      {/* Header Fixo */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-slate-100 shadow-sm transition-all duration-300">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2 cursor-pointer group active:scale-95 transition-transform" onClick={() => navigateToPage(Page.Home)}>
            <div className="text-amber-600 transition-transform group-hover:scale-110 group-hover:rotate-12 duration-500"><IconCross /></div>
            <div>
              <h1 className="text-lg md:text-xl font-bold text-slate-900 tracking-wider">MINHA SANTA FONTE</h1>
              <p className="text-[8px] md:text-[9px] text-amber-600 font-medium uppercase tracking-[0.2em] leading-none">Fontes | Artigos Religiosos</p>
            </div>
          </div>
          
          <nav className="hidden md:flex items-center space-x-8 text-[10px] font-black uppercase tracking-widest text-slate-500">
            {[
              { page: Page.Home, label: 'Início' },
              { page: Page.Catalog, label: 'Catálogo' },
              { page: Page.Customizer, label: 'Monte seu Terço' },
              { page: Page.About, label: 'Sobre Nós' }
            ].map(link => (
              <button 
                key={link.page} 
                onClick={() => navigateToPage(link.page)} 
                className={`relative py-1 group transition-colors hover:text-slate-900 ${currentPage === link.page ? 'text-amber-600' : ''}`}
              >
                {link.label}
                <span className={`absolute bottom-0 left-0 h-0.5 bg-amber-600 transition-all duration-300 ${currentPage === link.page ? 'w-full' : 'w-0 group-hover:w-full'}`}></span>
              </button>
            ))}
            {/* Link para o Dashboard apenas se logado */}
            {isAdmin && (
              <button onClick={() => navigateToPage(Page.AdminDashboard)} className="text-amber-600 hover:text-amber-800 transition-colors font-bold border border-amber-200 px-3 py-1 rounded-full bg-amber-50">
                Painel Admin
              </button>
            )}
          </nav>

          <div className="flex items-center space-x-2 md:space-x-4">
             <button className="relative p-2 hover:bg-slate-100 rounded-full transition-all active:scale-90" onClick={() => setIsCartOpen(true)}>
                <IconCart />
                {cartCount > 0 && <span className="absolute top-0 right-0 bg-amber-600 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center animate-bounce">{cartCount}</span>}
             </button>
             <button className="md:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-full transition-all" onClick={() => setIsMenuOpen(!isMenuOpen)}>
                {isMenuOpen ? <IconX /> : <IconMenu />}
             </button>
          </div>
        </div>

        {isMenuOpen && (
          <div className="md:hidden absolute top-full left-0 w-full bg-white/95 backdrop-blur-md border-b border-slate-100 shadow-xl animate-in slide-in-from-top duration-300">
            <nav className="flex flex-col p-6 space-y-6 text-[11px] font-black uppercase tracking-[0.2em] text-slate-600">
              <button onClick={() => navigateToPage(Page.Home)} className="text-left border-b border-slate-50 pb-2 hover:text-amber-600 transition-colors">Início</button>
              <button onClick={() => navigateToPage(Page.Catalog)} className="text-left border-b border-slate-50 pb-2 hover:text-amber-600 transition-colors">Catálogo</button>
              <button onClick={() => navigateToPage(Page.Customizer)} className="text-left border-b border-slate-50 pb-2 hover:text-amber-600 transition-colors">Monte seu Terço</button>
              <button onClick={() => navigateToPage(Page.About)} className="text-left border-b border-slate-50 pb-2 hover:text-amber-600 transition-colors">Sobre Nós</button>
              {isAdmin && <button onClick={() => navigateToPage(Page.AdminDashboard)} className="text-left text-amber-600 font-bold">Administração</button>}
            </nav>
          </div>
        )}
      </header>

      <main className="flex-grow">
        {/* --- PÁGINA INICIAL --- */}
        {currentPage === Page.Home && (
          <div className="animate-in fade-in duration-1000">
            <section className="relative h-[60vh] md:h-[75vh] flex items-center justify-center overflow-hidden">
              <img 
                src="https://img.freepik.com/fotos-premium/jesus-cristo-crucificado-na-cruz-no-monte-golgota-morreu-pelos-pecados-da-humanidade-filho-de-deus-biblia-fe-natal-religiao-catolica-cristao-feliz-pascoa-rezando-boa-sexta-feira-generative-ai_930683-474.jpg?w=2000" 
                className="absolute inset-0 w-full h-full object-cover scale-105 animate-[pulse_10s_ease-in-out_infinite]" 
                alt="Hero" 
              />
              <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-[2px]"></div>
              <div className="relative text-center text-white px-6 max-w-3xl space-y-6">
                <h2 className="text-4xl md:text-7xl font-serif leading-tight animate-in slide-in-from-bottom-6 duration-700">Espiritualidade e Paz para o seu Lar</h2>
                <p className="text-lg md:text-2xl font-light italic opacity-90 font-body-serif animate-in slide-in-from-bottom-10 duration-1000">Artigos que conectam você ao sagrado, com a tradição e o cuidado que sua fé merece.</p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4 animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-300">
                  <button onClick={() => navigateToPage(Page.Catalog)} className="px-10 py-5 bg-amber-600 text-white font-black text-[11px] uppercase tracking-widest rounded-full hover:bg-amber-700 transition-all shadow-[0_20px_40px_-10px_rgba(217,119,6,0.5)] hover:-translate-y-1 active:translate-y-0 active:scale-95">Ver Catálogo</button>
                  <button onClick={() => navigateToPage(Page.Customizer)} className="px-10 py-5 bg-white/10 backdrop-blur-md border border-white/30 text-white font-black text-[11px] uppercase tracking-widest rounded-full hover:bg-white/20 transition-all hover:-translate-y-1 active:scale-95">Monte seu Terço</button>
                </div>
              </div>
            </section>
            
            <section className="container mx-auto px-4 py-16 md:py-24 text-center">
               <span className="text-amber-600 font-bold text-[10px] uppercase tracking-[0.4em] mb-4 block animate-in fade-in">Destaques Selecionados</span>
               <h3 className="text-3xl md:text-5xl font-serif text-slate-900 mb-12 md:mb-16">Obras de Fé</h3>
               <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8 md:gap-12">
                  {products.filter(p => p.isFeatured).slice(0, 3).map((p, idx) => (
                    <div 
                      key={p.id} 
                      className="bg-white p-6 rounded-[40px] border border-slate-100 shadow-sm hover:shadow-[0_40px_80px_-20px_rgba(0,0,0,0.1)] transition-all duration-500 group cursor-pointer hover:-translate-y-2 animate-in slide-in-from-bottom-10"
                      style={{ animationDelay: `${idx * 150}ms` }}
                      onClick={() => navigateToProduct(p)}
                    >
                       <div className="aspect-[4/5] rounded-3xl overflow-hidden mb-8 relative">
                          <img src={p.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000 ease-out" alt={p.name} />
                       </div>
                       <h4 className="font-bold text-slate-800 mb-2 text-base md:text-lg group-hover:text-amber-700 transition-colors">{p.name}</h4>
                       <p className="text-amber-600 font-black text-sm md:text-base tracking-widest">R$ {p.price.toFixed(2)}</p>
                    </div>
                  ))}
               </div>
            </section>
          </div>
        )}

        {/* --- PÁGINA SOBRE (MANTIDA) --- */}
        {currentPage === Page.About && (
          <section className="container mx-auto px-6 py-16 md:py-24 animate-in fade-in duration-1000">
            <div className="max-w-5xl mx-auto space-y-16 md:space-y-28">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-20 items-center">
                <div className="order-2 md:order-1 space-y-8">
                  <div>
                    <span className="text-amber-600 font-bold text-[10px] uppercase tracking-[0.5em] mb-4 block">Nossa História</span>
                    <h2 className="text-4xl md:text-5xl font-serif text-slate-900 leading-tight">Onde a Fé Encontra a Arte</h2>
                  </div>
                  <div className="space-y-6 text-slate-600 font-body-serif leading-relaxed italic text-lg md:text-xl border-l-2 border-amber-100 pl-8">
                    <p>A "Minha Santa Fonte" nasceu do desejo profundo de levar o sagrado para dentro dos lares brasileiros de forma autêntica e zelosa.</p>
                    <p>Cada artigo é selecionado ou confeccionado com a intenção de ser um instrumento de oração e uma lembrança constante da presença de Deus em nosso cotidiano.</p>
                  </div>
                </div>
                <div className="relative order-1 md:order-2 group">
                  <div className="aspect-[4/5] rounded-[60px] overflow-hidden shadow-2xl transition-all duration-700 group-hover:rounded-[40px]">
                    <img src="https://images.unsplash.com/photo-1544427928-142f0685600b?auto=format&fit=crop&q=80&w=1000" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000" alt="História" />
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* --- CUSTOMIZADOR (MANTIDO) --- */}
        {currentPage === Page.Customizer && (
           <section className="container mx-auto px-4 py-16 md:py-24 max-w-6xl animate-in fade-in slide-in-from-bottom-4 duration-700">
              <div className="text-center mb-16 md:mb-20">
                 <h2 className="text-4xl md:text-5xl font-serif mb-4 text-slate-900">Monte seu Terço</h2>
                 <p className="text-slate-400 text-base font-body-serif italic">Personalize cada detalhe do seu instrumento de oração.</p>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                 <div className="lg:col-span-7 space-y-8">
                    <div className="bg-white p-8 md:p-12 rounded-[48px] shadow-sm border border-slate-100 min-h-[500px] flex flex-col">
                        <div className="flex justify-between items-center mb-10">
                          <div className="space-y-1">
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-600">Etapa Atual</p>
                            <h3 className="text-2xl font-serif text-slate-900">Passo {customStep}: {customStep === 1 ? 'O Material' : customStep === 2 ? 'A Cor' : 'O Crucifixo'}</h3>
                          </div>
                          {customStep > 1 && (
                            <button onClick={() => setCustomStep(s => s-1)} className="p-3 bg-slate-50 text-slate-400 rounded-full hover:bg-slate-100 hover:text-slate-900 transition-all active:scale-90">
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                            </button>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 flex-grow content-start">
                          {customStep === 1 && materials.map((m, i) => (
                            <button 
                              key={m.id} 
                              onClick={() => {setCustomSelections({...customSelections, material: m}); setCustomStep(2);}} 
                              className="p-6 border-2 border-slate-50 rounded-[32px] hover:border-amber-600/30 hover:bg-slate-50/50 transition-all duration-300 text-left flex items-center gap-5 group animate-in fade-in slide-in-from-right-4"
                              style={{ animationDelay: `${i * 100}ms` }}
                            >
                                <div className="w-16 h-16 rounded-2xl overflow-hidden border border-white shadow-sm group-hover:scale-110 transition-transform duration-500">
                                  <img src={m.image} className="w-full h-full object-cover" alt={m.name} />
                                </div>
                                <div><p className="font-bold text-slate-800 mb-1">{m.name}</p><p className="text-[10px] text-amber-600 font-black">+{m.price > 0 ? `R$ ${m.price.toFixed(2)}` : 'Incluso'}</p></div>
                            </button>
                          ))}
                          {customStep === 2 && colors.map((c, i) => (
                            <button 
                              key={c.id} 
                              onClick={() => {setCustomSelections({...customSelections, color: c}); setCustomStep(3);}} 
                              className="p-6 border-2 border-slate-50 rounded-[32px] hover:border-amber-600/30 hover:bg-slate-50/50 transition-all duration-300 text-left animate-in fade-in slide-in-from-right-4"
                              style={{ animationDelay: `${i * 100}ms` }}
                            >
                                <p className="font-bold text-slate-800 mb-1">{c.name}</p>
                                <p className="text-[10px] text-amber-600 font-black">+{c.price > 0 ? `R$ ${c.price.toFixed(2)}` : 'Incluso'}</p>
                            </button>
                          ))}
                          {customStep === 3 && crucifixes.map((x, i) => (
                            <button 
                              key={x.id} 
                              onClick={() => {setCustomSelections({...customSelections, crucifix: x}); setCustomStep(4);}} 
                              className="p-6 border-2 border-slate-50 rounded-[32px] hover:border-amber-600/30 hover:bg-slate-50/50 transition-all duration-300 text-left flex items-center gap-5 group animate-in fade-in slide-in-from-right-4"
                              style={{ animationDelay: `${i * 100}ms` }}
                            >
                                <div className="w-16 h-16 rounded-2xl overflow-hidden border border-white shadow-sm group-hover:scale-110 transition-transform duration-500">
                                  <img src={x.image} className="w-full h-full object-cover" alt={x.name} />
                                </div>
                                <div><p className="font-bold text-slate-800 mb-1">{x.name}</p><p className="text-[10px] text-amber-600 font-black">+{x.price > 0 ? `R$ ${x.price.toFixed(2)}` : 'Incluso'}</p></div>
                            </button>
                          ))}
                          {customStep >= 4 && (
                            <div className="col-span-full text-center py-10 space-y-8 animate-in zoom-in-95 duration-500">
                                <div className="p-10 bg-slate-50 rounded-[40px] border border-dashed border-slate-200">
                                  <p className="italic text-lg text-slate-500 font-body-serif">"Tudo o que pedirdes em oração, crendo, recebereis."</p>
                                </div>
                                <button onClick={addCustomToCart} className="w-full py-6 bg-slate-900 text-white rounded-3xl font-black text-xs uppercase tracking-[0.3em] shadow-[0_30px_60px_-15px_rgba(15,23,42,0.4)] hover:bg-amber-600 transition-all hover:-translate-y-2 active:scale-95 active:translate-y-0">Adicionar à Cesta 🙏</button>
                            </div>
                          )}
                        </div>
                    </div>
                 </div>

                 <div className="hidden lg:flex lg:col-span-5 flex-col sticky top-32 h-fit">
                    <div className="bg-white rounded-[56px] shadow-2xl border border-slate-50 overflow-hidden group">
                       <div className="aspect-[4/5] bg-slate-50 relative flex items-center justify-center p-12 overflow-hidden">
                          {customSelections.material && (
                            <img src={customSelections.material.image} className="absolute inset-0 w-full h-full object-cover mix-blend-multiply opacity-60 animate-in fade-in scale-110 duration-1000" alt="Material" />
                          )}
                          {customSelections.crucifix ? (
                            <img src={customSelections.crucifix.image} className="relative z-10 w-56 h-56 rounded-[40px] border-8 border-white shadow-[0_40px_80px_-20px_rgba(0,0,0,0.3)] object-cover animate-in slide-in-from-bottom-10 duration-700" alt="Crucifixo" />
                          ) : (
                            <div className="relative z-10 p-16 text-slate-200 transition-transform group-hover:scale-110 duration-1000"><IconCross /></div>
                          )}
                       </div>
                       <div className="p-10 border-t border-slate-50 space-y-6">
                          <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.4em] text-center">Resumo da Confecção</h4>
                          <div className="space-y-4 text-sm font-medium">
                             <div className="flex justify-between items-center text-slate-500"><span>Base do Ateliê</span><span className="font-bold text-slate-900">R$ {baseRosaryPrice.toFixed(2)}</span></div>
                             {customSelections.material && (
                               <div className="flex justify-between items-center text-slate-900">
                                 <span>{customSelections.material.name}</span>
                                 <span className="text-amber-600 font-bold">+{customSelections.material.price.toFixed(2)}</span>
                               </div>
                             )}
                             <div className="pt-8 border-t flex justify-between items-end">
                                <div>
                                  <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1">Total</p>
                                  <p className="text-4xl font-black text-slate-900">R$ {calculateCustomPrice().toFixed(2)}</p>
                                </div>
                             </div>
                          </div>
                       </div>
                    </div>
                 </div>
              </div>
           </section>
        )}

        {/* --- CATÁLOGO (MANTIDO) --- */}
        {currentPage === Page.Catalog && (
          <section className="container mx-auto px-4 py-16 md:py-20 animate-in fade-in duration-700">
             {/* Cabeçalho do Catálogo */}
             <div className="mb-12 space-y-2 text-center md:text-left">
                <h2 className="text-4xl md:text-5xl font-serif text-slate-900">Catálogo de Fé</h2>
                <p className="text-slate-400 italic font-body-serif">Explore nossa curadoria de artigos sagrados.</p>
             </div>

             {/* Painel de Filtros Organizado */}
             <div className="bg-white p-6 md:p-8 rounded-[40px] border border-slate-100 shadow-sm mb-12 space-y-8 animate-in slide-in-from-top-4 duration-500">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                   {/* Busca */}
                   <div className="lg:col-span-4 relative group">
                      <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-amber-600 transition-colors">
                        <IconSearch />
                      </div>
                      <input 
                        type="text" 
                        placeholder="O que você busca hoje?..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-14 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all text-sm font-medium"
                      />
                   </div>

                   {/* Ordenação */}
                   <div className="lg:col-span-3 flex items-center gap-3">
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 whitespace-nowrap">Ordenar por:</span>
                      <select 
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="flex-grow p-3.5 bg-slate-50 border border-slate-100 rounded-xl outline-none text-[10px] font-bold uppercase tracking-widest cursor-pointer focus:border-amber-500 transition-all"
                      >
                         <option value="recent">Mais Recentes</option>
                         <option value="price_asc">Menor Preço</option>
                         <option value="price_desc">Maior Preço</option>
                      </select>
                   </div>

                   {/* Resumo de Resultados */}
                   <div className="lg:col-span-5 flex justify-end items-center gap-4 text-slate-400">
                      <div className="h-px flex-grow bg-slate-50 hidden lg:block"></div>
                      <p className="text-[10px] font-black uppercase tracking-widest">
                         {filteredProducts.length} {filteredProducts.length === 1 ? 'Artigo encontrado' : 'Artigos encontrados'}
                      </p>
                   </div>
                </div>

                {/* Categorias como Chips */}
                <div className="pt-6 border-t border-slate-50">
                   <div className="flex flex-wrap gap-2 justify-center lg:justify-start">
                      {CATEGORIES.map((c) => {
                        const count = c === "Todos" ? products.length : products.filter(p => p.category === c).length;
                        return (
                          <button 
                            key={c} 
                            onClick={() => setSelectedCategory(c)} 
                            className={`px-6 py-3 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all duration-300 flex items-center gap-2 ${selectedCategory === c ? 'bg-slate-900 text-white shadow-xl border-slate-900 scale-105' : 'bg-white text-slate-400 border-slate-100 hover:border-slate-300 hover:text-slate-600'}`}
                          >
                            {c}
                            <span className={`text-[8px] px-1.5 py-0.5 rounded-full ${selectedCategory === c ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-400'}`}>{count}</span>
                          </button>
                        );
                      })}
                   </div>
                </div>
             </div>
             
             {/* Grade de Produtos */}
             {paginatedProducts.length > 0 ? (
               <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6 md:gap-10 mb-20 min-h-[600px] content-start">
                  {paginatedProducts.map((p, idx) => (
                    <div 
                      key={p.id} 
                      className="group cursor-pointer space-y-4 animate-in fade-in slide-in-from-bottom-6 duration-500" 
                      style={{ animationDelay: `${idx * 100}ms` }}
                      onClick={() => navigateToProduct(p)}
                    >
                       <div className="aspect-square bg-white rounded-[32px] md:rounded-[48px] overflow-hidden border border-slate-100 relative shadow-sm group-hover:shadow-2xl group-hover:-translate-y-2 transition-all duration-700">
                          <img src={p.image} className="w-full h-full object-cover group-hover:scale-110 transition-all duration-1000 ease-in-out" alt={p.name} />
                          {p.stock === 0 && <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center text-white text-[10px] font-black uppercase tracking-widest">Esgotado</div>}
                       </div>
                       <div className="px-2 space-y-1">
                         <h4 className="font-bold text-sm md:text-base text-slate-800 truncate group-hover:text-amber-700 transition-colors">{p.name}</h4>
                         <p className="text-amber-600 font-bold text-base md:text-lg">R$ {p.price.toFixed(2)}</p>
                       </div>
                    </div>
                  ))}
               </div>
             ) : (
                <div className="py-32 text-center animate-in zoom-in-95 duration-700">
                   <div className="text-6xl mb-6 opacity-20">🕊️</div>
                   <h3 className="text-2xl font-serif text-slate-900 mb-2">Nenhum artigo encontrado</h3>
                   <p className="text-slate-400 font-body-serif italic max-w-sm mx-auto">Tente ajustar seus filtros ou buscar por outros termos de oração.</p>
                   <button 
                    onClick={() => {setSearchTerm(""); setSelectedCategory("Todos");}} 
                    className="mt-8 px-8 py-3 bg-slate-900 text-white rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-amber-600 transition-all"
                   >
                    Limpar Filtros
                   </button>
                </div>
             )}

             {/* Paginação Inteligente */}
             {totalCatalogPages > 1 && (
               <div className="flex flex-col items-center gap-8 mt-12 animate-in slide-in-from-bottom-6 duration-1000">
                 <div className="flex items-center gap-3">
                   {/* Botão Anterior */}
                   <button 
                    onClick={() => {setCatalogPage(prev => Math.max(prev - 1, 1)); window.scrollTo({ top: 400, behavior: 'smooth' });}}
                    disabled={catalogPage === 1}
                    className={`flex items-center justify-center gap-2 pl-4 pr-6 py-4 rounded-full border border-slate-100 text-[9px] font-black uppercase tracking-widest transition-all active:scale-95 ${catalogPage === 1 ? 'opacity-30 cursor-not-allowed text-slate-300' : 'bg-white hover:bg-slate-900 hover:text-white hover:shadow-2xl'}`}
                   >
                     <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" /></svg>
                     Anterior
                   </button>
                   
                   {/* Números das Páginas */}
                   <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-full border border-slate-100 shadow-sm">
                     {Array.from({ length: totalCatalogPages }).map((_, i) => {
                        const pageNum = i + 1;
                        return (
                          <button
                            key={pageNum}
                            onClick={() => {setCatalogPage(pageNum); window.scrollTo({ top: 400, behavior: 'smooth' });}}
                            className={`w-10 h-10 rounded-full text-[11px] font-black transition-all duration-300 ${catalogPage === pageNum ? 'bg-amber-600 text-white shadow-[0_10px_20px_-5px_rgba(217,119,6,0.4)] scale-110' : 'text-slate-400 hover:text-slate-900 hover:bg-slate-50'}`}
                          >
                            {pageNum}
                          </button>
                        );
                     })}
                   </div>

                   {/* Botão Próximo */}
                   <button 
                    onClick={() => {setCatalogPage(prev => Math.min(prev + 1, totalCatalogPages)); window.scrollTo({ top: 400, behavior: 'smooth' });}}
                    disabled={catalogPage === totalCatalogPages}
                    className={`flex items-center justify-center gap-2 pl-6 pr-4 py-4 rounded-full border border-slate-100 text-[9px] font-black uppercase tracking-widest transition-all active:scale-95 ${catalogPage === totalCatalogPages ? 'opacity-30 cursor-not-allowed text-slate-300' : 'bg-white hover:bg-slate-900 hover:text-white hover:shadow-2xl'}`}
                   >
                     Próximo
                     <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" /></svg>
                   </button>
                 </div>
                 
                 {/* Indicador de Status da Paginação */}
                 <div className="flex flex-col items-center gap-2">
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-300">
                       Exibindo {((catalogPage - 1) * ITEMS_PER_PAGE) + 1} - {Math.min(catalogPage * ITEMS_PER_PAGE, filteredProducts.length)} de {filteredProducts.length} artigos
                    </p>
                    <div className="w-32 h-1 bg-slate-100 rounded-full overflow-hidden">
                       <div 
                        className="h-full bg-amber-600 transition-all duration-500" 
                        style={{ width: `${(catalogPage / totalCatalogPages) * 100}%` }}
                       ></div>
                    </div>
                 </div>
               </div>
             )}
          </section>
        )}

        {/* --- PÁGINA DO PRODUTO (MANTIDO) --- */}
        {currentPage === Page.Product && selectedProduct && (
          <section className="container mx-auto px-6 py-12 md:py-20 animate-in fade-in duration-700">
            <button 
              onClick={() => navigateToPage(Page.Catalog)} 
              className="group flex items-center gap-2 text-[10px] font-black uppercase text-slate-400 mb-12 hover:text-slate-900 transition-colors"
            >
              <span className="group-hover:-translate-x-1 transition-transform">←</span> Voltar ao Catálogo
            </button>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 md:gap-20 items-start">
              <div className="lg:col-span-7 flex flex-col gap-6">
                <div className="aspect-square rounded-[48px] md:rounded-[64px] overflow-hidden bg-white border border-slate-100 shadow-xl relative group">
                   <img 
                    src={selectedVariant?.image || selectedProduct.images?.[activeImageIndex] || selectedProduct.image} 
                    className="w-full h-full object-cover transition-all duration-1000 ease-in-out group-hover:scale-105" 
                    alt={selectedProduct.name} 
                   />
                   {selectedVariant?.image && (
                      <div className="absolute top-6 right-6 bg-amber-600/90 text-white px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest backdrop-blur-sm shadow-xl animate-in zoom-in duration-500">
                        Opção: {selectedVariant.name}
                      </div>
                   )}
                </div>
                <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
                  {(selectedProduct.images || [selectedProduct.image]).map((img, idx) => (
                    <button 
                      key={idx} 
                      onClick={() => {setActiveImageIndex(idx); setSelectedVariant(null);}} 
                      className={`w-20 h-20 md:w-24 md:h-24 rounded-2xl overflow-hidden border-2 flex-shrink-0 transition-all duration-300 ${activeImageIndex === idx && !selectedVariant ? 'border-amber-600 scale-105 shadow-lg' : 'border-transparent opacity-50 hover:opacity-100 hover:scale-95'}`}
                    >
                      <img src={img} className="w-full h-full object-cover" alt="galeria" />
                    </button>
                  ))}
                </div>
              </div>
              <div className="lg:col-span-5 space-y-10 md:space-y-14">
                <div className="space-y-4">
                   <span className="text-amber-600 font-bold text-[10px] uppercase tracking-[0.5em] mb-2 block animate-in fade-in slide-in-from-top-2">{selectedProduct.category}</span>
                   <h2 className="text-3xl md:text-5xl font-serif text-slate-900 leading-tight animate-in fade-in slide-in-from-top-4 duration-700">{selectedProduct.name}</h2>
                   <div className="flex items-center space-x-4 animate-in fade-in slide-in-from-top-6 duration-1000">
                      <h3 className="text-3xl md:text-4xl font-black text-slate-900">R$ {(selectedProduct.price + (selectedVariant?.priceDelta || 0)).toFixed(2)}</h3>
                   </div>
                </div>

                {selectedProduct.variants && selectedProduct.variants.length > 0 && (
                   <div className="space-y-4 animate-in fade-in slide-in-from-top-8 duration-1000">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Escolha uma Variação</h4>
                      <div className="flex flex-wrap gap-3">
                         {selectedProduct.variants.map((v, i) => (
                            <button 
                              key={i} 
                              onClick={() => setSelectedVariant(v)} 
                              className={`px-6 py-4 rounded-[20px] text-[11px] font-bold transition-all border flex items-center gap-3 ${selectedVariant?.name === v.name ? 'border-amber-600 bg-amber-50 text-amber-900 ring-4 ring-amber-600/10 scale-105' : 'border-slate-100 bg-white text-slate-500 hover:border-slate-300 hover:scale-[0.98]'}`}
                            >
                               {v.image && <img src={v.image} className="w-6 h-6 rounded-full object-cover border border-white shadow-sm" alt="" />}
                               {v.name}
                            </button>
                         ))}
                      </div>
                   </div>
                )}

                <div className="space-y-4 animate-in fade-in slide-in-from-top-10 duration-1000">
                   <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Descrição Detalhada</h4>
                   <p className="text-slate-600 font-body-serif italic text-lg leading-relaxed">{selectedProduct.description}</p>
                </div>

                <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-10 duration-1000">
                  {/* Seção de Compartilhamento */}
                  <div className="pt-4 space-y-4 border-t border-slate-100">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Propagar a Fé (Compartilhar)</h4>
                    <div className="flex flex-wrap gap-3">
                      <a 
                        href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`Confira este artigo religioso na Minha Santa Fonte: ${selectedProduct.name} - ${window.location.href}`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-3 bg-[#25D366] text-white rounded-2xl hover:scale-110 active:scale-95 transition-all shadow-md hover:shadow-xl"
                        title="WhatsApp"
                      >
                        <IconWhatsApp size="w-5 h-5" />
                      </a>
                      <a 
                        href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-3 bg-[#1877F2] text-white rounded-2xl hover:scale-110 active:scale-95 transition-all shadow-md hover:shadow-xl"
                        title="Facebook"
                      >
                        <IconFacebook />
                      </a>
                      <a 
                        href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Confira este artigo religioso na Minha Santa Fonte: ${selectedProduct.name}`)}&url=${encodeURIComponent(window.location.href)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-3 bg-[#000000] text-white rounded-2xl hover:scale-110 active:scale-95 transition-all shadow-md hover:shadow-xl"
                        title="Twitter / X"
                      >
                        <IconTwitter />
                      </a>
                      <button 
                        onClick={copyProductLink}
                        className={`p-3 rounded-2xl hover:scale-110 active:scale-95 transition-all shadow-md hover:shadow-xl flex items-center gap-2 text-[10px] font-black uppercase tracking-widest ${copyFeedback ? 'bg-green-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                      >
                        <IconLink />
                        {copyFeedback ? 'Copiado!' : 'Copiar Link'}
                      </button>
                    </div>
                  </div>

                  <div className="p-8 bg-slate-50 rounded-[40px] border border-slate-100 flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Disponibilidade</p>
                      <p className={`text-base font-bold ${selectedProduct.stock > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {selectedProduct.stock > 0 ? `${selectedProduct.stock} unidades prontas` : 'Sob Encomenda'}
                      </p>
                    </div>
                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-amber-600 shadow-sm">
                      <IconCross />
                    </div>
                  </div>
                  
                  <button 
                    onClick={() => addToCart(selectedProduct)} 
                    disabled={selectedProduct.stock <= 0} 
                    className="w-full py-6 bg-slate-900 text-white rounded-[28px] font-black text-[11px] uppercase tracking-[0.4em] shadow-[0_30px_60px_-15px_rgba(15,23,42,0.4)] hover:bg-amber-600 transition-all hover:-translate-y-2 active:scale-95 active:translate-y-0 disabled:bg-slate-300 disabled:shadow-none"
                  >
                    Levar para Minha Casa 🙏
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* --- DASHBOARD ADMINISTRATIVO --- */}
        {currentPage === Page.AdminDashboard && isAdmin && (
           <div className="min-h-screen bg-[#f8fafc] flex flex-col lg:flex-row font-sans">
              <aside className="w-full lg:w-72 bg-[#0a0f1a] text-white p-6 lg:p-10 flex flex-col shrink-0 border-r border-white/5 transition-all duration-500">
                 <div className="flex items-center justify-between lg:justify-start lg:gap-3 mb-12 animate-in fade-in slide-in-from-left duration-700">
                    <div className="flex items-center space-x-2 text-amber-500"><IconCross /></div>
                    <div className="leading-tight">
                      <span className="block font-bold tracking-tighter text-lg uppercase">Admin MSF</span>
                      <span className="text-[8px] uppercase tracking-[0.3em] text-amber-500 font-bold">Gerenciamento</span>
                    </div>
                 </div>
                 
                 <nav className="flex flex-row lg:flex-col gap-2 overflow-x-auto no-scrollbar lg:space-y-1 mb-auto">
                    {[
                      { id: 'products', label: 'Artigos', icon: '🛍️' },
                      { id: 'stock', label: 'Inventário', icon: '📦' },
                      { id: 'customizer', label: 'Ateliê', icon: '🎨' },
                      { id: 'production', label: 'Produção', icon: '🔨' },
                      { id: 'balance', label: 'Balanço', icon: '💰' }
                    ].map((tab, idx) => (
                      <button 
                        key={tab.id} 
                        onClick={() => setAdminTab(tab.id as any)} 
                        className={`whitespace-nowrap flex items-center gap-4 px-6 py-4 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-all duration-300 animate-in slide-in-from-left ${adminTab === tab.id ? 'bg-amber-600 text-white shadow-[0_15px_30px_-5px_rgba(217,119,6,0.4)] scale-105' : 'text-slate-500 hover:bg-white/5 hover:text-slate-300'}`}
                        style={{ animationDelay: `${idx * 100}ms` }}
                      >
                        <span className="text-lg opacity-80">{tab.icon}</span>
                        {tab.label}
                      </button>
                    ))}
                 </nav>
                 
                 <div className="mt-8 pt-8 border-t border-white/5 space-y-4 animate-in fade-in duration-1000 delay-500">
                    <button onClick={() => navigateToPage(Page.Home)} className="w-full text-left px-6 py-3 text-[9px] font-black uppercase text-slate-600 hover:text-white transition-colors">Voltar ao Site</button>
                    <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 py-4 bg-red-500/10 text-red-400 text-[10px] font-black uppercase rounded-2xl hover:bg-red-500 hover:text-white transition-all border border-red-500/20 active:scale-95">
                      Encerrar Sessão
                    </button>
                 </div>
              </aside>

              <section className="flex-grow p-4 md:p-8 lg:p-12 overflow-y-auto animate-in fade-in duration-700">
                 <div className="max-w-6xl mx-auto">
                    {/* ... (Cabeçalho Admin) */}
                    <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
                       <div className="space-y-2">
                          <h3 className="text-3xl md:text-4xl font-serif text-slate-900 capitalize tracking-tight">{adminTab === 'products' ? (editingProduct ? 'Editando Peça' : 'Publicar Nova Peça') : adminTab === 'stock' ? 'Controle de Estoque' : adminTab === 'customizer' ? 'Configurações do Ateliê' : adminTab === 'balance' ? 'Balanço de Vendas' : adminTab === 'production' ? 'Quadro de Produção' : 'Painel'}</h3>
                          <p className="text-slate-400 text-sm font-body-serif italic">Zele pela qualidade e apresentação dos seus artigos sacros.</p>
                       </div>
                       {adminTab === 'products' && editingProduct && (
                          <button onClick={() => {
                            setEditingProduct(null);
                            setNewProduct({ name: '', category: CATEGORIES[1], price: 0, stock: 10, description: '', images: [], variants: [], isFeatured: false });
                          }} className="flex items-center gap-2 px-6 py-3 bg-slate-100 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-95">
                            <IconX /> Cancelar Edição
                          </button>
                       )}
                    </div>

                    {/* CONTEÚDO DAS ABAS (MANTIDO EXATAMENTE IGUAL) */}
                    {adminTab === 'products' && (
                      <div className="space-y-8 animate-in zoom-in-95 duration-500">
                        {/* Formulário de Cadastro/Edição */}
                        <div className="bg-white p-8 md:p-12 rounded-[48px] shadow-[0_40px_80px_-20_rgba(0,0,0,0.05)] border border-slate-50">
                          <form onSubmit={handleSaveProduct} className="space-y-12">
                             {/* ... (Campos do Formulário - Mantidos) ... */}
                             <div className="space-y-8">
                              <div className="flex items-center gap-4 border-b border-slate-100 pb-4">
                                 <div className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-bold">1</div>
                                 <h4 className="text-[12px] font-black uppercase tracking-[0.2em] text-slate-400">Identificação do Artigo</h4>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-2">
                                  <label className="text-[10px] font-black uppercase text-slate-500 ml-2">Título da Obra</label>
                                  <input type="text" placeholder="Ex: Crucifixo de Parede em Bronze" value={newProduct.name || ''} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-3xl outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 transition-all text-slate-800" onChange={e => setNewProduct(p => ({ ...p, name: e.target.value }))} required />
                                </div>
                                <div className="space-y-2">
                                  <label className="text-[10px] font-black uppercase text-slate-500 ml-2">Coleção / Categoria</label>
                                  <select value={newProduct.category} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-3xl outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 transition-all appearance-none cursor-pointer" onChange={e => setNewProduct(p => ({ ...p, category: e.target.value }))}>
                                    {CATEGORIES.slice(1).map(c => <option key={c} value={c}>{c}</option>)}
                                  </select>
                                </div>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
                                <div className="space-y-2">
                                  <label className="text-[10px] font-black uppercase text-slate-500 ml-2">Investimento Base (R$)</label>
                                  <input type="number" step="0.01" value={newProduct.price || 0} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-3xl outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 transition-all" onChange={e => setNewProduct(p => ({ ...p, price: Number(e.target.value) }))} required />
                                </div>
                                <div className="space-y-2">
                                  <label className="text-[10px] font-black uppercase text-slate-500 ml-2">Unidades em Estoque</label>
                                  <input type="number" value={newProduct.stock || 0} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-3xl outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 transition-all" onChange={e => setNewProduct(p => ({ ...p, stock: Number(e.target.value) }))} required />
                                </div>
                                <div className="flex items-center gap-4 pt-8">
                                  <div className="relative inline-block w-12 h-6 transition duration-200 ease-in-out">
                                    <input type="checkbox" id="featured-admin" checked={newProduct.isFeatured} onChange={e => setNewProduct(p => ({ ...p, isFeatured: e.target.checked }))} className="absolute w-12 h-6 opacity-0 z-10 cursor-pointer" />
                                    <label htmlFor="featured-admin" className={`absolute inset-0 rounded-full transition-colors cursor-pointer ${newProduct.isFeatured ? 'bg-amber-600' : 'bg-slate-300'}`}>
                                      <span className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform transform ${newProduct.isFeatured ? 'translate-x-6' : 'translate-x-0'}`}></span>
                                    </label>
                                  </div>
                                  <label htmlFor="featured-admin" className="text-[11px] font-black uppercase text-slate-600 cursor-pointer">Destaque na Vitrine</label>
                                </div>
                              </div>
                              <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-slate-500 ml-2">Narrativa do Artigo</label>
                                <textarea rows={4} placeholder="Descreva a origem, o propósito e os detalhes que tornam esta peça especial..." value={newProduct.description || ''} className="w-full p-6 bg-slate-50 border border-slate-100 rounded-3xl outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500 transition-all font-body-serif italic text-lg" onChange={e => setNewProduct(p => ({ ...p, description: e.target.value }))} required />
                              </div>
                            </div>

                            <div className="space-y-8">
                              <div className="flex items-center gap-4 border-b border-slate-100 pb-4">
                                 <div className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-bold">2</div>
                                 <h4 className="text-[12px] font-black uppercase tracking-[0.2em] text-slate-400">Apresentação Visual</h4>
                              </div>
                              <div className="flex gap-4">
                                  <input type="text" placeholder="Cole o link da imagem aqui..." value={tempImageUrl} className="flex-grow p-5 bg-slate-50 border border-slate-100 rounded-3xl outline-none focus:ring-4 focus:ring-amber-500/10" onChange={e => setTempImageUrl(e.target.value)} />
                                  <button type="button" onClick={addImageUrlToProduct} className="px-8 bg-slate-900 text-white rounded-3xl hover:bg-amber-600 transition-all shadow-xl active:scale-95"><IconPlus /></button>
                              </div>
                              <div className="flex flex-wrap gap-6">
                                 {newProduct.images?.map((img, idx) => (
                                    <div key={idx} className="relative w-32 h-32 group animate-in zoom-in-50 duration-500" style={{ animationDelay: `${idx * 100}ms` }}>
                                       <img src={img} className="w-full h-full object-cover rounded-[32px] border-2 border-white shadow-lg transition-all duration-500 group-hover:scale-110" alt="preview" />
                                       <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-[32px] flex items-center justify-center">
                                         <button type="button" onClick={() => removeImageFromProduct(idx)} className="bg-red-50 text-white p-3 rounded-full shadow-2xl hover:scale-110 transition-transform"><IconTrash /></button>
                                       </div>
                                       {idx === 0 && <span className="absolute -top-3 -left-3 bg-amber-600 text-white text-[8px] font-black px-4 py-1.5 rounded-full shadow-xl uppercase tracking-widest ring-4 ring-white">Capa</span>}
                                    </div>
                                 ))}
                              </div>
                            </div>

                            {/* --- NOVA SEÇÃO: VARIANTES --- */}
                            <div className="space-y-8">
                                <div className="flex items-center gap-4 border-b border-slate-100 pb-4">
                                   <div className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-bold">3</div>
                                   <h4 className="text-[12px] font-black uppercase tracking-[0.2em] text-slate-400">Variantes e Cores</h4>
                                </div>
                                <div className="bg-slate-50 p-6 rounded-[32px] border border-slate-100 space-y-4">
                                   <p className="text-[10px] font-black uppercase text-slate-500 ml-2">Adicionar Variante</p>
                                   <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                                      <input 
                                        placeholder="Nome (Ex: Azul Real, Pequeno)" 
                                        value={tempVariantName} 
                                        onChange={e => setTempVariantName(e.target.value)}
                                        className="p-4 bg-white border border-slate-200 rounded-2xl outline-none text-sm focus:border-amber-500"
                                      />
                                      <input 
                                        type="number" 
                                        placeholder="Preço Extra (+/-)" 
                                        value={tempVariantPrice} 
                                        onChange={e => setTempVariantPrice(Number(e.target.value))}
                                        className="p-4 bg-white border border-slate-200 rounded-2xl outline-none text-sm focus:border-amber-500"
                                      />
                                      <input 
                                        placeholder="URL Imagem da Variante (Opcional)" 
                                        value={tempVariantImage} 
                                        onChange={e => setTempVariantImage(e.target.value)}
                                        className="p-4 bg-white border border-slate-200 rounded-2xl outline-none text-sm focus:border-amber-500"
                                      />
                                      <button type="button" onClick={addVariantToProduct} className="p-4 bg-slate-900 text-white rounded-2xl hover:bg-amber-600 transition-all font-bold text-xs uppercase tracking-widest shadow-lg active:scale-95">Adicionar</button>
                                   </div>
                                   
                                   {/* Lista de Variantes Adicionadas */}
                                   {newProduct.variants && newProduct.variants.length > 0 && (
                                     <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-4">
                                       {newProduct.variants.map((variant, i) => (
                                          <div key={i} className="bg-white p-3 rounded-2xl border border-slate-200 flex items-center justify-between shadow-sm">
                                             <div className="flex items-center gap-3">
                                                {variant.image ? <img src={variant.image} className="w-8 h-8 rounded-lg object-cover" /> : <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-xs">?</div>}
                                                <div className="text-xs">
                                                   <p className="font-bold text-slate-800">{variant.name}</p>
                                                   <p className="text-slate-500">{variant.priceDelta > 0 ? `+ R$ ${variant.priceDelta}` : 'Sem custo extra'}</p>
                                                </div>
                                             </div>
                                             <button type="button" onClick={() => removeVariantFromProduct(i)} className="text-red-400 hover:text-red-600 p-2"><IconTrash /></button>
                                          </div>
                                       ))}
                                     </div>
                                   )}
                                </div>
                            </div>

                            <div className="pt-10">
                              <button type="submit" className="group w-full py-8 bg-amber-600 text-white rounded-[32px] font-black text-xs uppercase tracking-[0.5em] shadow-[0_40px_80px_-20_rgba(217,119,6,0.6)] hover:bg-amber-700 transition-all transform hover:-translate-y-2 active:translate-y-0 active:scale-95">
                                 <span className="flex items-center justify-center gap-3">
                                   {editingProduct ? 'Confirmar Atualizações 🙏' : 'Publicar Artigo para o Mundo 🙏'}
                                 </span>
                              </button>
                            </div>
                          </form>
                        </div>

                        {/* --- LISTA DE PRODUTOS CADASTRADOS (PARA EDIÇÃO/EXCLUSÃO) --- */}
                        <div className="mt-16 pt-16 border-t border-slate-200">
                           <h4 className="text-2xl font-serif text-slate-900 mb-8">Acervo Cadastrado</h4>
                           <div className="bg-white rounded-[40px] shadow-sm border border-slate-100 overflow-hidden">
                              <table className="w-full text-left">
                                <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                                   <tr>
                                      <th className="p-6">Imagem</th>
                                      <th className="p-6">Artigo</th>
                                      <th className="p-6">Categoria</th>
                                      <th className="p-6 text-center">Ações</th>
                                   </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                   {products.map(p => (
                                      <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                                         <td className="p-4 w-24">
                                            <img src={p.image} className="w-16 h-16 rounded-2xl object-cover border border-slate-100 shadow-sm" alt={p.name} />
                                         </td>
                                         <td className="p-6 font-bold text-slate-700">{p.name}</td>
                                         <td className="p-6 text-xs uppercase tracking-widest text-slate-500">{p.category}</td>
                                         <td className="p-6 text-center">
                                            <div className="flex justify-center gap-3">
                                               <button 
                                                 onClick={() => {
                                                   setEditingProduct(p); 
                                                   setNewProduct({
                                                     ...p, 
                                                     variants: p.variants || [], 
                                                     images: p.images || [p.image]
                                                   });
                                                   window.scrollTo({ top: 0, behavior: 'smooth' });
                                                 }} 
                                                 className="p-3 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors font-bold text-[10px] uppercase tracking-wider flex items-center gap-2"
                                               >
                                                  <IconEdit /> Editar
                                               </button>
                                               <button 
                                                 onClick={() => deleteProduct(p.id)} 
                                                 className="p-3 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors font-bold text-[10px] uppercase tracking-wider flex items-center gap-2"
                                               >
                                                  <IconTrash /> Excluir
                                               </button>
                                            </div>
                                         </td>
                                      </tr>
                                   ))}
                                </tbody>
                              </table>
                              {products.length === 0 && (
                                 <div className="p-12 text-center text-slate-400 italic">Nenhum produto cadastrado ainda.</div>
                              )}
                           </div>
                        </div>
                      </div>
                    )}

                    {/* --- ABA DE INVENTÁRIO (MANTIDO IGUAL) --- */}
                    {adminTab === 'stock' && (
                      <div className="bg-white rounded-[48px] shadow-sm border border-slate-100 overflow-hidden animate-in fade-in">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left">
                            <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                              <tr>
                                <th className="p-6">Artigo</th>
                                <th className="p-6 text-center">Estoque Atual</th>
                                <th className="p-6 text-right">Ajuste Rápido</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                              {products.map(p => (
                                <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                                  <td className="p-6 font-bold text-slate-700">{p.name}</td>
                                  <td className="p-6 text-center">
                                    <span className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${p.stock < 5 ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-600'}`}>
                                      {p.stock} un
                                    </span>
                                  </td>
                                  <td className="p-6 text-right">
                                    <div className="flex justify-end gap-2">
                                       <button onClick={() => updateStock(p.id, -1)} className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-red-50 hover:text-red-500 font-bold transition-all text-slate-500">-</button>
                                       <button onClick={() => updateStock(p.id, 1)} className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-green-50 hover:text-green-500 font-bold transition-all text-slate-500">+</button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* --- ABA DO ATELIÊ (MANTIDO IGUAL) --- */}
                    {adminTab === 'customizer' && (
                      <div className="space-y-8 animate-in fade-in">
                         <div className="bg-slate-900 text-white p-8 md:p-10 rounded-[40px] shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
                            <div>
                              <h4 className="text-amber-500 font-black text-xs uppercase tracking-[0.3em] mb-2">Mão de Obra Base</h4>
                              <p className="opacity-60 text-sm">Valor inicial para qualquer terço personalizado.</p>
                            </div>
                            <div className="flex items-center gap-4 bg-white/10 p-4 rounded-2xl border border-white/10">
                               <span className="text-2xl font-serif">R$</span>
                               <input 
                                 type="number" 
                                 value={baseRosaryPrice} 
                                 onChange={(e) => saveBasePrice(Number(e.target.value))}
                                 className="bg-transparent text-3xl font-bold w-32 outline-none text-center"
                               />
                            </div>
                         </div>

                         <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100">
                            <h4 className="font-bold text-slate-900 mb-6 flex items-center gap-3 uppercase text-xs tracking-widest">
                              <span className="w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center font-black text-lg">+</span>
                              Adicionar Nova Opção
                            </h4>
                            <form onSubmit={handleSaveCustomOption} className="grid grid-cols-1 md:grid-cols-4 gap-4">
                              <div className="md:col-span-1">
                                <select 
                                  className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none text-xs font-bold uppercase tracking-widest focus:border-amber-500 transition-all cursor-pointer"
                                  value={editingCustomOption.type}
                                  onChange={e => setEditingCustomOption({ ...editingCustomOption, type: e.target.value as any })}
                                >
                                   <option value="">Tipo do Item...</option>
                                   <option value="material">Conta (Material)</option>
                                   <option value="color">Cor</option>
                                   <option value="crucifix">Crucifixo</option>
                                </select>
                              </div>
                              <input type="text" placeholder="Nome da Opção" className="p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none text-sm" value={tempCustomOption.name} onChange={e => setTempCustomOption({ ...tempCustomOption, name: e.target.value })} />
                               <input type="number" placeholder="Valor Adicional (R$)" className="p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none text-sm" value={tempCustomOption.price} onChange={e => setTempCustomOption({ ...tempCustomOption, price: Number(e.target.value) })} />
                              <button className="bg-slate-900 text-white font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-amber-600 transition-all shadow-lg active:scale-95">Salvar</button>
                            </form>
                             <div className="mt-8 pt-8 border-t border-slate-50 grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div><h5 className="text-[10px] font-black uppercase text-slate-400 mb-3">Materiais</h5><ul className="space-y-2">{materials.map(m => (<li key={m.id} className="flex justify-between items-center text-sm group"><span>{m.name}</span><button onClick={() => deleteCustomOption('material', m.id)} className="text-red-300 hover:text-red-500"><IconTrash/></button></li>))}</ul></div>
                                <div><h5 className="text-[10px] font-black uppercase text-slate-400 mb-3">Cores</h5><ul className="space-y-2">{colors.map(c => (<li key={c.id} className="flex justify-between items-center text-sm group"><span>{c.name}</span><button onClick={() => deleteCustomOption('color', c.id)} className="text-red-300 hover:text-red-500"><IconTrash/></button></li>))}</ul></div>
                                <div><h5 className="text-[10px] font-black uppercase text-slate-400 mb-3">Crucifixos</h5><ul className="space-y-2">{crucifixes.map(x => (<li key={x.id} className="flex justify-between items-center text-sm group"><span>{x.name}</span><button onClick={() => deleteCustomOption('crucifix', x.id)} className="text-red-300 hover:text-red-500"><IconTrash/></button></li>))}</ul></div>
                             </div>
                         </div>
                      </div>
                    )}

                    {/* --- ABA DE PRODUÇÃO (MANTIDO IGUAL) --- */}
                    {adminTab === 'production' && (
                       <div className="space-y-8 animate-in fade-in">
                          <div className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-100">
                             <h4 className="font-bold text-slate-900 mb-6 text-sm uppercase tracking-widest">Lançar Novo Pedido na Produção</h4>
                             <form onSubmit={handleAddSale} className="flex flex-col md:flex-row gap-4">
                                <input type="text" placeholder="Descrição do Pedido (Ex: Encomenda WhatsApp - Maria - Terço Azul)" className="flex-grow p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none text-sm" value={newSale.description} onChange={e => setNewSale({...newSale, description: e.target.value})} required />
                                <div className="flex gap-4">
                                  <input type="number" placeholder="Valor (R$)" className="w-full md:w-40 p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none text-sm" value={newSale.value} onChange={e => setNewSale({...newSale, value: e.target.value})} />
                                  <button className="px-8 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-amber-600 transition-all shadow-lg active:scale-95 whitespace-nowrap">Adicionar</button>
                                </div>
                             </form>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                             {/* Coluna A FAZER */}
                             <div className="space-y-4">
                                <div className="flex items-center gap-3 mb-4"><span className="w-3 h-3 rounded-full bg-slate-300"></span><h4 className="font-black uppercase tracking-[0.2em] text-slate-500 text-xs">A Fazer</h4><span className="text-xs bg-slate-200 px-2 py-0.5 rounded-full font-bold text-slate-600">{salesHistory.filter(s => !s.status || s.status === 'pending').length}</span></div>
                                <div className="bg-slate-100 p-4 rounded-[32px] min-h-[50vh] space-y-4">{salesHistory.filter(s => !s.status || s.status === 'pending').map(order => (<div key={order.id} className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200 group"><p className="font-bold text-slate-800 mb-1">{order.description}</p><div className="flex justify-between items-end"><span className="text-xs text-slate-400 font-bold">{order.date}</span><div className="flex gap-2"><button onClick={() => updateSaleStatus(order.id, 'in_progress')} className="bg-blue-100 text-blue-600 px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-blue-600 hover:text-white transition-all">Iniciar →</button></div></div></div>))}</div>
                             </div>
                             {/* Coluna EM CONFECÇÃO */}
                             <div className="space-y-4">
                                <div className="flex items-center gap-3 mb-4"><span className="w-3 h-3 rounded-full bg-amber-500"></span><h4 className="font-black uppercase tracking-[0.2em] text-amber-600 text-xs">Em Confecção</h4><span className="text-xs bg-amber-100 px-2 py-0.5 rounded-full font-bold text-amber-700">{salesHistory.filter(s => s.status === 'in_progress').length}</span></div>
                                <div className="bg-amber-50 p-4 rounded-[32px] min-h-[50vh] space-y-4 border border-amber-100">{salesHistory.filter(s => s.status === 'in_progress').map(order => (<div key={order.id} className="bg-white p-5 rounded-3xl shadow-sm border border-amber-100 group"><p className="font-bold text-slate-800 mb-1">{order.description}</p><div className="flex justify-between items-end"><span className="text-xs text-slate-400 font-bold">{order.date}</span><div className="flex gap-2"><button onClick={() => updateSaleStatus(order.id, 'pending')} className="bg-slate-100 text-slate-600 px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-slate-200 transition-all">←</button><button onClick={() => updateSaleStatus(order.id, 'done')} className="bg-green-100 text-green-600 px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-green-600 hover:text-white transition-all">Concluir →</button></div></div></div>))}</div>
                             </div>
                             {/* Coluna PRONTOS */}
                             <div className="space-y-4">
                                <div className="flex items-center gap-3 mb-4"><span className="w-3 h-3 rounded-full bg-green-500"></span><h4 className="font-black uppercase tracking-[0.2em] text-green-600 text-xs">Prontos / Enviados</h4><span className="text-xs bg-green-100 px-2 py-0.5 rounded-full font-bold text-green-700">{salesHistory.filter(s => s.status === 'done').length}</span></div>
                                <div className="bg-green-50 p-4 rounded-[32px] min-h-[50vh] space-y-4 border border-green-100">{salesHistory.filter(s => s.status === 'done').map(order => (<div key={order.id} className="bg-white p-5 rounded-3xl shadow-sm border border-green-100 opacity-60 hover:opacity-100 transition-opacity"><p className="font-bold text-slate-800 mb-1 line-through decoration-slate-300">{order.description}</p><div className="flex justify-between items-end"><span className="text-xs text-slate-400 font-bold">{order.date}</span><button onClick={() => updateSaleStatus(order.id, 'in_progress')} className="bg-slate-100 text-slate-400 px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-slate-200 transition-all">Retornar</button></div></div>))}</div>
                             </div>
                          </div>
                       </div>
                    )}

                    {/* --- ABA DE BALANÇO FINANCEIRO (MANTIDO IGUAL) --- */}
                    {adminTab === 'balance' && (
                      <div className="space-y-8 animate-in fade-in">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                           <div className="bg-amber-500 text-white p-10 rounded-[40px] shadow-xl shadow-amber-500/20"><p className="text-[10px] font-black uppercase tracking-[0.3em] mb-2 opacity-80">Total de Vendas</p><h3 className="text-5xl font-serif">R$ {salesHistory.reduce((acc, item) => acc + item.value, 0).toFixed(2)}</h3></div>
                           <div className="bg-white p-10 rounded-[40px] shadow-sm border border-slate-100"><h4 className="font-bold text-slate-900 mb-6 text-sm uppercase tracking-widest">Lançamento Manual</h4><form onSubmit={handleAddSale} className="space-y-4"><input type="text" placeholder="Descrição do Pedido (Ex: João - 2 Terços)" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none text-sm" value={newSale.description} onChange={e => setNewSale({...newSale, description: e.target.value})} /><div className="flex gap-4"><input type="number" placeholder="Valor (R$)" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none text-sm" value={newSale.value} onChange={e => setNewSale({...newSale, value: e.target.value})} /><button className="px-8 bg-green-600 text-white rounded-2xl font-black text-xl hover:bg-green-700 transition-all active:scale-95">+</button></div></form><p className="text-xs text-slate-400 mt-2 text-center">O pedido será adicionado automaticamente à fila de produção.</p></div>
                        </div>
                        <div className="bg-white rounded-[40px] shadow-sm border border-slate-100 overflow-hidden"><div className="p-8 border-b border-slate-50"><h4 className="font-bold text-slate-900 text-sm uppercase tracking-widest">Histórico de Transações</h4></div><div className="overflow-x-auto"><table className="w-full text-left"><thead className="bg-slate-50 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400"><tr><th className="p-6">Data</th><th className="p-6">Descrição</th><th className="p-6">Status</th><th className="p-6 text-right">Valor</th><th className="p-6 text-right">Ação</th></tr></thead><tbody className="divide-y divide-slate-50">{salesHistory.map(sale => (<tr key={sale.id} className="hover:bg-slate-50/50"><td className="p-6 text-xs font-bold text-slate-500">{sale.date}</td><td className="p-6 font-medium text-slate-700">{sale.description}</td><td className="p-6"><span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${sale.status === 'done' ? 'bg-green-100 text-green-600' : sale.status === 'in_progress' ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500'}`}>{sale.status === 'done' ? 'Pronto' : sale.status === 'in_progress' ? 'Fazendo' : 'Pendente'}</span></td><td className="p-6 text-right font-black text-green-600">R$ {sale.value.toFixed(2)}</td><td className="p-6 text-right"><button onClick={() => deleteSale(sale.id)} className="w-8 h-8 rounded-full bg-red-50 text-red-400 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center"><IconTrash /></button></td></tr>))}{salesHistory.length === 0 && (<tr><td colSpan={5} className="p-12 text-center text-slate-400 italic">Nenhum registro encontrado.</td></tr>)}</tbody></table></div></div>
                      </div>
                    )}
                 </div>
              </section>
           </div>
        )}

        {/* --- LOGIN ADMIN (ATUALIZADO) --- */}
        {currentPage === Page.AdminLogin && (
           <section className="container mx-auto px-6 py-12 flex items-center justify-center min-h-[70vh] animate-in fade-in duration-1000">
              <div className="bg-white p-12 md:p-20 rounded-[64px] shadow-2xl border border-slate-50 max-w-lg w-full text-center space-y-12">
                 <div className="space-y-4">
                    <div className="inline-flex p-5 bg-amber-50 text-amber-600 rounded-[32px] animate-bounce"><IconCross /></div>
                    <h2 className="text-3xl font-serif text-slate-900 tracking-tight uppercase">Acesso Restrito</h2>
                 </div>
                 <form onSubmit={handleAdminLogin} className="space-y-6">
                    <input name="email" type="email" className="w-full p-6 bg-slate-50 border border-slate-100 rounded-[32px] outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-600 transition-all text-center" placeholder="E-mail" required />
                    <input name="password" type="password" className="w-full p-6 bg-slate-50 border border-slate-100 rounded-[32px] outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-600 transition-all text-center" placeholder="Senha" required />
                    {loginError && <p className="text-red-500 text-[10px] font-black uppercase tracking-widest">{loginError}</p>}
                    <button type="submit" className="w-full py-6 bg-slate-900 text-white rounded-[32px] font-black text-xs tracking-[0.4em] shadow-2xl hover:bg-amber-600 transition-all uppercase active:scale-95">Autenticar 🙏</button>
                 </form>
                 <button onClick={() => navigateToPage(Page.Home)} className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600">Voltar ao Site</button>
              </div>
           </section>
        )}
      </main>

      {/* --- RODAPÉ --- */}
      <footer className="bg-[#0a0f1a] text-slate-400 py-20 px-6 border-t border-white/5">
        <div className="container mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-16 md:mb-24 text-center md:text-left">
          {/* ... (Partes do Rodapé mantidas) ... */}
          <div className="space-y-6 flex flex-col items-center md:items-start animate-in fade-in duration-1000">
            <div className="flex items-center space-x-3 text-white">
              <span className="text-amber-500 text-4xl font-light transition-transform duration-700 cursor-default">+</span>
              <h2 className="text-2xl font-serif tracking-tighter leading-tight">MINHA SANTA<br/>FONTE</h2>
            </div>
            <p className="font-body-serif italic text-sm leading-relaxed opacity-60 max-w-xs">Transformando espaços comuns em lugares de oração e contemplação através da arte sacra e devoção.</p>
          </div>
          <div className="hidden md:block animate-in fade-in duration-1000 delay-200">
            <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 mb-10">Navegação</h3>
            <ul className="space-y-6 text-[11px] font-bold uppercase tracking-widest">
              <li><button onClick={() => navigateToPage(Page.Home)} className="hover:text-amber-600 hover:translate-x-2 transition-all">Início</button></li>
              <li><button onClick={() => navigateToPage(Page.Catalog)} className="hover:text-amber-600 hover:translate-x-2 transition-all">Catálogo</button></li>
              <li><button onClick={() => navigateToPage(Page.Customizer)} className="hover:text-amber-600 hover:translate-x-2 transition-all">Monte seu Terço</button></li>
              <li><button onClick={() => navigateToPage(Page.About)} className="hover:text-amber-600 hover:translate-x-2 transition-all">Sobre Nós</button></li>
            </ul>
          </div>
          <div className="animate-in fade-in duration-1000 delay-400">
            <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 mb-8">Atendimento</h3>
            <ul className="space-y-6 text-[12px] font-medium tracking-wide">
              <li className="hover:text-white transition-colors cursor-pointer truncate">atendimento@minhasantafonte.com</li>
              <li className="hover:text-white transition-colors cursor-pointer">(75) 99225-7902</li>
            </ul>
          </div>
          <div className="animate-in fade-in duration-1000 delay-600">
            <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 mb-8">Comunidade</h3>
            <div className="flex bg-white/5 rounded-[24px] overflow-hidden p-1.5 border border-white/5">
              <input type="email" placeholder="Seu melhor e-mail" className="bg-transparent border-none outline-none px-5 py-3 text-[11px] flex-grow text-white placeholder:text-slate-700" />
              <button className="bg-amber-600 text-white px-7 py-3 text-[10px] font-black uppercase rounded-[18px] hover:bg-amber-700 transition-all active:scale-95">Amém</button>
            </div>
          </div>
        </div>
        <div className="container mx-auto pt-12 border-t border-white/5 flex flex-col md:flex-row justify-between items-center text-[9px] font-black uppercase tracking-[0.3em] opacity-40 gap-6">
          <p>© 2024-2026 MINHA SANTA FONTE | ARTE SACRA & TRADIÇÃO</p>
          {/* Link discreto para Admin */}
          {!isAdmin && <button onClick={() => navigateToPage(Page.AdminLogin)} className="hover:text-white transition-colors">Área Restrita</button>}
        </div>
      </footer>

      {/* Botão Flutuante WhatsApp (Mantido) */}
      <a 
        href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent("Olá! Gostaria de saber mais sobre os artigos da Minha Santa Fonte.")}`}
        target="_blank" 
        rel="noopener noreferrer" 
        className="fixed bottom-8 right-8 md:bottom-12 md:right-12 z-50 bg-[#22c55e] w-16 h-16 md:w-22 md:h-22 rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-90 transition-all duration-500 group animate-bounce-slow"
      >
        <div className="absolute -top-14 right-0 bg-white text-[#22c55e] px-6 py-3 rounded-full text-[10px] font-black uppercase tracking-[0.2em] shadow-2xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-500 translate-y-4 group-hover:translate-y-0 whitespace-nowrap border border-green-50">Canal de Oração</div>
        <IconWhatsApp />
      </a>

      {/* Carrinho Overlay (Mantido) */}
      {isCartOpen && (
        <div className="fixed inset-0 z-[60] flex justify-end">
           <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-md animate-in fade-in duration-500" onClick={() => setIsCartOpen(false)}></div>
           <div className="relative w-full max-w-sm md:max-w-md bg-white h-full shadow-2xl p-8 md:p-14 flex flex-col animate-in slide-in-from-right duration-700">
              <div className="flex justify-between items-center mb-14">
                 <div>
                    <h3 className="text-3xl font-serif text-slate-900 leading-tight">Sua Cesta</h3>
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 mt-2">{cartCount} Artigos escolhidos</p>
                 </div>
                 <button onClick={() => setIsCartOpen(false)} className="p-4 bg-slate-50 text-slate-400 rounded-full hover:bg-slate-100 hover:text-slate-900 transition-all active:scale-90 shadow-sm"><IconX /></button>
              </div>
              
              <div className="flex-grow overflow-y-auto space-y-8 pr-2 no-scrollbar">
                 {cart.length === 0 ? (
                    <div className="text-center py-24 space-y-8 animate-in zoom-in-90 duration-700">
                       <div className="text-7xl opacity-10">🛒</div>
                       <p className="text-slate-400 italic font-body-serif text-xl">Sua cesta está vazia no momento...</p>
                       <button onClick={() => {setIsCartOpen(false); navigateToPage(Page.Catalog);}} className="text-[10px] font-black uppercase tracking-[0.4em] text-amber-600 hover:text-amber-700 transition-colors border-b-2 border-amber-600/30 pb-2">Explorar Catálogo</button>
                    </div>
                 ) : cart.map((item, idx) => (
                   <div key={`${item.id}-${idx}`} className="flex gap-6 group animate-in slide-in-from-bottom duration-500" style={{ animationDelay: `${idx * 100}ms` }}>
                      <div className="w-20 h-20 md:w-24 md:h-24 rounded-[32px] overflow-hidden shadow-lg border border-slate-50 shrink-0">
                         <img src={item.image} className="w-full h-full object-cover transition-transform group-hover:scale-110" alt="item" />
                      </div>
                      <div className="flex-grow min-w-0 flex flex-col justify-center space-y-1">
                         <h4 className="font-bold text-base text-slate-800 truncate group-hover:text-amber-700 transition-colors">{item.name}</h4>
                         {item.selectedVariant && (
                            <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Opção: {item.selectedVariant.name}</p>
                         )}
                         <p className="text-amber-600 font-bold text-base">R$ {item.price.toFixed(2)}</p>
                      </div>
                      <button onClick={() => removeFromCart(item.id, item.selectedVariant?.name)} className="text-[9px] text-red-300 font-black uppercase tracking-[0.2em] h-fit mt-2 hover:text-red-600 transition-all hover:scale-110">Excluir</button>
                   </div>
                 ))}
              </div>

              <div className="pt-10 border-t border-slate-50 mt-10 space-y-8">
                 <div className="flex justify-between items-end">
                    <div className="space-y-1">
                       <span className="text-[11px] uppercase tracking-[0.5em] text-slate-400 block">Total Investido</span>
                       <span className="text-4xl font-black text-slate-900 tracking-tighter">R$ {cartTotal.toFixed(2)}</span>
                    </div>
                 </div>
                 <button 
                  onClick={handleCheckoutWhatsApp}
                  className="w-full py-6 bg-slate-900 text-white rounded-[32px] font-black text-xs uppercase tracking-[0.5em] shadow-[0_40px_80px_-20_rgba(15,23,42,0.4)] hover:bg-amber-600 transition-all active:scale-95 flex items-center justify-center gap-3"
                 >
                   <span>Finalizar via WhatsApp 🙏</span>
                 </button>
              </div>
           </div>
        </div>
      )}
      
      <style>{`
        @keyframes bounce-slow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-15px); }
        }
        .animate-bounce-slow {
          animation: bounce-slow 4s ease-in-out infinite;
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
};

export default App;
