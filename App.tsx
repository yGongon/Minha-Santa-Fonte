
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

const ITEMS_PER_PAGE = 8;
const WHATSAPP_NUMBER = "5575992257902"; 

// Interface para o Balanço Financeiro
interface SaleEntry {
  id: string;
  date: string;
  description: string;
  value: number;
}

const App: React.FC = () => {
  // --- Estados de Navegação e Autenticação ---
  const [currentPage, setCurrentPage] = useState<Page>(Page.Home);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [adminTab, setAdminTab] = useState<'products' | 'stock' | 'customizer' | 'balance'>('products');

  // --- Estados de Dados ---
  const [products, setProducts] = useState<Product[]>([]);
  const [materials, setMaterials] = useState<RosaryOption[]>([]);
  const [colors, setColors] = useState<RosaryOption[]>([]);
  const [crucifixes, setCrucifixes] = useState<RosaryOption[]>([]);
  const [baseRosaryPrice, setBaseRosaryPrice] = useState<number>(40.00);
  
  // Estado para o Balanço Financeiro
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

  // --- Inicialização (Carregar do Supabase com Seeding Automático) ---
  const fetchData = async () => {
    // 1. Produtos
    const { data: productsData, error: productsError } = await supabase.from('products').select('*');
    
    if (productsError) console.error("Erro ao buscar produtos:", productsError);

    if (productsData && productsData.length > 0) {
      setProducts(productsData);
    } else {
      // Se o banco estiver vazio, popula com os produtos iniciais (Seeding)
      const seedProducts = INITIAL_PRODUCTS.map(p => ({
        ...p,
        images: p.images || [p.image],
        variants: p.variants || [],
        createdAt: Date.now(),
        price: Number(p.price),
        stock: Number(p.stock)
      }));
      
      const { error: insertError } = await supabase.from('products').insert(seedProducts);
      
      if (!insertError) {
        setProducts(seedProducts);
        console.log("Banco de dados populado com produtos iniciais.");
      } else {
        console.warn("Usando dados locais (Falha ao popular DB):", insertError);
        setProducts(seedProducts); 
      }
    }

    // 2. Vendas
    const { data: salesData } = await supabase.from('sales').select('*').order('id', { ascending: false });
    if (salesData) setSalesHistory(salesData);

    // 3. Opções do Ateliê
    const { data: optionsData } = await supabase.from('custom_options').select('*');
    
    if (optionsData && optionsData.length > 0) {
      setMaterials(optionsData.filter((o: any) => o.type === 'material'));
      setColors(optionsData.filter((o: any) => o.type === 'color'));
      setCrucifixes(optionsData.filter((o: any) => o.type === 'crucifix'));
    } else {
      // Seeding das opções do ateliê
      const seedOptions = [
         ...INITIAL_MATERIALS.map(m => ({ ...m, type: 'material' })),
         ...INITIAL_COLORS.map(c => ({ ...c, type: 'color' })),
         ...INITIAL_CRUCIFIXES.map(x => ({ ...x, type: 'crucifix' }))
      ];
      
      const { error: optError } = await supabase.from('custom_options').insert(seedOptions);
      
      if (!optError) {
        setMaterials(INITIAL_MATERIALS);
        setColors(INITIAL_COLORS);
        setCrucifixes(INITIAL_CRUCIFIXES);
      } else {
        setMaterials(INITIAL_MATERIALS);
        setColors(INITIAL_COLORS);
        setCrucifixes(INITIAL_CRUCIFIXES);
      }
    }

    // 4. Configuração (Preço Base)
    const { data: configData } = await supabase.from('config').select('value').eq('key', 'base_rosary_price').single();
    if (configData) setBaseRosaryPrice(Number(configData.value));
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- Funções Auxiliares de Banco de Dados ---
  const saveProductsToDB = async (updatedList: Product[]) => {
    setProducts([...updatedList]); // Atualiza UI imediatamente (Optimistic UI)
    // Em um cenário real, faríamos upsert apenas do item modificado, 
    // mas aqui vamos garantir que o item editado seja salvo.
    // A função que chama essa lógica já deve ter preparado o objeto.
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

    // Salvar no Supabase
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
    if (window.confirm("Tem certeza que deseja remover este produto?")) {
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
    
    // Atualiza UI
    setProducts(products.map(p => p.id === id ? { ...p, stock: newStock } : p));
    
    // Atualiza DB
    await supabase.from('products').update({ stock: newStock }).eq('id', id);
  };

  // --- Funções do Ateliê (Supabase) ---
  const saveCustomOptions = async (type: 'material' | 'color' | 'crucifix', newOption: RosaryOption) => {
    // Adiciona o tipo ao objeto para salvar na tabela única 'custom_options'
    const payload = { ...newOption, type };
    
    const { error } = await supabase.from('custom_options').upsert(payload);
    
    if (error) {
      alert('Erro ao salvar opção: ' + error.message);
      return;
    }

    // Atualiza estado local
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

  // --- Funções do Balanço Financeiro (Supabase) ---
  const handleAddSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSale.description || !newSale.value) return;
    
    const entry: SaleEntry = {
      id: `sale-${Date.now()}`,
      date: new Date().toLocaleDateString('pt-BR'),
      description: newSale.description,
      value: Number(newSale.value)
    };
    
    const { error } = await supabase.from('sales').insert(entry);
    
    if (error) {
      alert("Erro ao lançar venda: " + error.message);
      return;
    }
    
    setSalesHistory([entry, ...salesHistory]);
    setNewSale({ description: '', value: '' });
  };

  const deleteSale = async (id: string) => {
    if (window.confirm("Deseja remover este registro do histórico?")) {
      const { error } = await supabase.from('sales').delete().eq('id', id);
      if (!error) {
        setSalesHistory(salesHistory.filter(s => s.id !== id));
      }
    }
  };

  // --- Funções de Carrinho e UI (Mantidas iguais, sem DB) ---
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

  const handleAdminLogin = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    if (formData.get("user") === "admin" && formData.get("pass") === "santa123") {
      setIsAdmin(true);
      setCurrentPage(Page.AdminDashboard);
      setLoginError("");
    } else {
      setLoginError("Credenciais inválidas.");
    }
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

  const startEditingCustomOption = (type: 'material' | 'color' | 'crucifix', option: RosaryOption) => {
    setEditingCustomOption({ type, option });
    setTempCustomOption({ ...option });
  };

  const cartTotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const cartCount = cart.reduce((acc, item) => acc + item.quantity, 0);
  
  // --- Lógica Avançada de Filtragem e Ordenação ---
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
  const IconWhatsApp = ({ size = "w-8 h-8" }: { size?: string }) => <svg className={`${size} text-white`} fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.72.94 3.675 1.438 5.662 1.439h.005c6.552 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>;
  const IconFacebook = () => <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" /></svg>;
  const IconTwitter = () => <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>;
  const IconLink = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.828a4 4 0 015.656 0l4 4a4 4 0 01-5.656 5.656l-1.1-1.1" /></svg>;

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
            <button onClick={() => navigateToPage(Page.AdminLogin)} className="text-amber-700/50 hover:text-amber-700 transition-colors">Admin</button>
          </nav>

          <div className="flex items-center space-x-2 md:space-x-4">
             {isAdmin && <span className="hidden sm:inline bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest animate-pulse">Modo Admin</span>}
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
              <button onClick={() => navigateToPage(Page.AdminLogin)} className="text-left text-amber-600 font-bold">Administração</button>
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

        {/* --- PÁGINA SOBRE --- */}
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

        {/* --- CUSTOMIZADOR --- */}
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
                                <div><p className="font-bold text-slate-800 mb-1">{x.name}</p><p className="text-[10px] text-amber-600 font-black">+{x.price > 0 ? `R$ ${x.price.toFixed(2)}