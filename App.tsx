
import React, { useState, useMemo, useEffect } from 'react';
import { Product, CartItem, Page, CustomRosary, ProductVariant, RosaryOption } from './types';
import { 
  PRODUCTS as INITIAL_PRODUCTS, 
  CATEGORIES, 
  ROSARY_MATERIALS as INITIAL_MATERIALS,
  ROSARY_COLORS as INITIAL_COLORS,
  ROSARY_CRUCIFIXES as INITIAL_CRUCIFIXES
} from './constants';

const App: React.FC = () => {
  // --- Estados de Navegação e Autenticação ---
  const [currentPage, setCurrentPage] = useState<Page>(Page.Home);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [adminTab, setAdminTab] = useState<'products' | 'stock' | 'customizer' | 'blog'>('products');

  // --- Estados de Dados ---
  const [products, setProducts] = useState<Product[]>([]);
  const [materials, setMaterials] = useState<RosaryOption[]>([]);
  const [colors, setColors] = useState<RosaryOption[]>([]);
  const [crucifixes, setCrucifixes] = useState<RosaryOption[]>([]);
  const [baseRosaryPrice, setBaseRosaryPrice] = useState<number>(40.00);
  
  const [selectedCategory, setSelectedCategory] = useState<string>("Todos");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);

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

  // --- Inicialização ---
  useEffect(() => {
    const savedProducts = localStorage.getItem('msf_db_products');
    if (savedProducts) {
      setProducts(JSON.parse(savedProducts));
    } else {
      const initialized = INITIAL_PRODUCTS.map(p => ({ ...p, images: p.images || [p.image], createdAt: Date.now() }));
      setProducts(initialized);
      localStorage.setItem('msf_db_products', JSON.stringify(initialized));
    }

    const savedMaterials = localStorage.getItem('msf_custom_materials');
    setMaterials(savedMaterials ? JSON.parse(savedMaterials) : INITIAL_MATERIALS);
    
    const savedColors = localStorage.getItem('msf_custom_colors');
    setColors(savedColors ? JSON.parse(savedColors) : INITIAL_COLORS);
    
    const savedCrucifixes = localStorage.getItem('msf_custom_crucifixes');
    setCrucifixes(savedCrucifixes ? JSON.parse(savedCrucifixes) : INITIAL_CRUCIFIXES);

    const savedBasePrice = localStorage.getItem('msf_base_rosary_price');
    if (savedBasePrice) setBaseRosaryPrice(Number(savedBasePrice));
  }, []);

  const saveProductsToDB = (updatedList: Product[]) => {
    setProducts([...updatedList]);
    localStorage.setItem('msf_db_products', JSON.stringify(updatedList));
  };

  const saveCustomOptions = (type: 'material' | 'color' | 'crucifix', list: RosaryOption[]) => {
    const key = `msf_custom_${type}s`;
    localStorage.setItem(key, JSON.stringify(list));
    if (type === 'material') setMaterials([...list]);
    if (type === 'color') setColors([...list]);
    if (type === 'crucifix') setCrucifixes([...list]);
  };

  const saveBasePrice = (val: number) => {
    setBaseRosaryPrice(val);
    localStorage.setItem('msf_base_rosary_price', val.toString());
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
      description: `Customizado: ${customSelections.material?.name}, ${customSelections.color?.name}`,
      image: customSelections.material?.image || materials[0]?.image || "",
      quantity: 1,
      stock: 1,
      isCustom: true
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
  
  const updateStock = (id: string, delta: number) => {
    const updated = products.map(p => p.id === id ? { ...p, stock: Math.max(0, p.stock + delta) } : p);
    saveProductsToDB(updated);
  };

  const deleteProduct = (id: string) => {
    if (window.confirm("Tem certeza que deseja remover este produto?")) {
      const updated = products.filter(p => p.id !== id);
      saveProductsToDB(updated);
    }
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

  const handleSaveProduct = (e: React.FormEvent) => {
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

    if (editingProduct) {
      const updatedList = products.map(p => p.id === editingProduct.id ? { ...p, ...productData } : p);
      saveProductsToDB(updatedList as Product[]);
      setEditingProduct(null);
    } else {
      const productToAdd: Product = { 
        ...productData as Product,
        id: "prod-" + Date.now(), 
        createdAt: Date.now() 
      };
      saveProductsToDB([productToAdd, ...products]);
    }

    setNewProduct({ name: '', category: CATEGORIES[1], price: 0, stock: 10, description: '', images: [], variants: [], isFeatured: false });
  };

  const startEditingProduct = (product: Product) => {
    setEditingProduct(product);
    setNewProduct({ ...product });
    setAdminTab('products');
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

  const addVariantToProduct = () => { 
    if (tempVariantName.trim()) { 
      setNewProduct(p => ({ 
        ...p, 
        variants: [...(p.variants || []), { name: tempVariantName.trim(), priceDelta: tempVariantPrice, image: tempVariantImage.trim() || undefined }] 
      })); 
      setTempVariantName(""); 
      setTempVariantPrice(0); 
      setTempVariantImage("");
    } 
  };

  const removeVariantFromProduct = (index: number) => {
    setNewProduct(p => ({
      ...p,
      variants: p.variants?.filter((_, i) => i !== index)
    }));
  };

  const handleSaveCustomOption = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomOption.type) return;
    
    const type = editingCustomOption.type as 'material' | 'color' | 'crucifix';
    const currentList = type === 'material' ? materials : type === 'color' ? colors : crucifixes;
    
    const newOpt: RosaryOption = { 
      id: editingCustomOption.option?.id || `opt-${Date.now()}`, 
      name: tempCustomOption.name || 'Nova Opção', 
      price: Number(tempCustomOption.price) || 0, 
      image: tempCustomOption.image 
    };
    
    const updatedList = editingCustomOption.option 
      ? currentList.map(o => o.id === editingCustomOption.option?.id ? newOpt : o) 
      : [...currentList, newOpt];
      
    saveCustomOptions(type, updatedList);
    setEditingCustomOption({ type: '', option: null });
    setTempCustomOption({ name: '', price: 0, image: '' });
  };

  const deleteCustomOption = (type: 'material' | 'color' | 'crucifix', id: string) => {
    if (window.confirm("Remover esta opção do customizador?")) {
      const currentList = type === 'material' ? materials : type === 'color' ? colors : crucifixes;
      saveCustomOptions(type, currentList.filter(o => o.id !== id));
    }
  };

  const startEditingCustomOption = (type: 'material' | 'color' | 'crucifix', option: RosaryOption) => {
    setEditingCustomOption({ type, option });
    setTempCustomOption({ ...option });
  };

  const cartTotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const cartCount = cart.reduce((acc, item) => acc + item.quantity, 0);
  const filteredProducts = useMemo(() => {
    let list = selectedCategory === "Todos" ? products : products.filter(p => p.category === selectedCategory);
    return [...list].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [selectedCategory, products]);

  const navigateToProduct = (product: Product) => { 
    setSelectedProduct(product); 
    setSelectedVariant(null); 
    setActiveImageIndex(0); 
    setCurrentPage(Page.Product); 
    setIsMenuOpen(false); 
    window.scrollTo(0, 0); 
  };
  
  const navigateToPage = (page: Page) => { 
    setCurrentPage(page); 
    setIsMenuOpen(false); 
    window.scrollTo(0, 0); 
  };

  // --- Ícones ---
  const IconCross = () => <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M11 2h2v7h7v2h-7v11h-2v-11h-7v-2h7v-7z" /></svg>;
  const IconCart = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>;
  const IconMenu = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7" /></svg>;
  const IconX = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>;
  const IconPlus = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>;
  const IconEdit = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>;
  const IconTrash = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>;
  const IconWhatsApp = () => <svg className="w-8 h-8 md:w-10 md:h-10 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.72.94 3.675 1.438 5.662 1.439h.005c6.552 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Header Fixo */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-100">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2 cursor-pointer group" onClick={() => navigateToPage(Page.Home)}>
            <div className="text-amber-600 transition-transform group-hover:scale-110"><IconCross /></div>
            <div>
              <h1 className="text-lg md:text-xl font-bold text-slate-900 tracking-wider">MINHA SANTA FONTE</h1>
              <p className="text-[8px] md:text-[9px] text-amber-600 font-medium uppercase tracking-[0.2em] leading-none">Fontes | Artigos Religiosos</p>
            </div>
          </div>
          
          <nav className="hidden md:flex items-center space-x-8 text-[10px] font-black uppercase tracking-widest text-slate-500">
            <button onClick={() => navigateToPage(Page.Home)} className={currentPage === Page.Home ? 'text-amber-600' : ''}>Início</button>
            <button onClick={() => navigateToPage(Page.Catalog)} className={currentPage === Page.Catalog ? 'text-amber-600' : ''}>Catálogo</button>
            <button onClick={() => navigateToPage(Page.Customizer)} className={currentPage === Page.Customizer ? 'text-amber-600' : ''}>Monte seu Terço</button>
            <button onClick={() => navigateToPage(Page.About)} className={currentPage === Page.About ? 'text-amber-600' : ''}>Sobre Nós</button>
            <button onClick={() => navigateToPage(Page.AdminLogin)} className="text-amber-700/50 hover:text-amber-700">Admin</button>
          </nav>

          <div className="flex items-center space-x-2 md:space-x-4">
             {isAdmin && <span className="hidden sm:inline bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest">Modo Admin</span>}
             <button className="relative p-2" onClick={() => setIsCartOpen(true)}>
                <IconCart />
                {cartCount > 0 && <span className="absolute -top-1 -right-1 bg-amber-600 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">{cartCount}</span>}
             </button>
             <button className="md:hidden p-2 text-slate-600" onClick={() => setIsMenuOpen(!isMenuOpen)}>
                {isMenuOpen ? <IconX /> : <IconMenu />}
             </button>
          </div>
        </div>

        {isMenuOpen && (
          <div className="md:hidden absolute top-full left-0 w-full bg-white border-b border-slate-100 shadow-xl animate-in slide-in-from-top duration-300">
            <nav className="flex flex-col p-6 space-y-6 text-[11px] font-black uppercase tracking-[0.2em] text-slate-600">
              <button onClick={() => navigateToPage(Page.Home)} className="text-left border-b border-slate-50 pb-2">Início</button>
              <button onClick={() => navigateToPage(Page.Catalog)} className="text-left border-b border-slate-50 pb-2">Catálogo</button>
              <button onClick={() => navigateToPage(Page.Customizer)} className="text-left border-b border-slate-50 pb-2">Monte seu Terço</button>
              <button onClick={() => navigateToPage(Page.About)} className="text-left border-b border-slate-50 pb-2">Sobre Nós</button>
              <button onClick={() => navigateToPage(Page.AdminLogin)} className="text-left text-amber-600">Administração</button>
            </nav>
          </div>
        )}
      </header>

      <main className="flex-grow">
        {currentPage === Page.Home && (
          <>
            <section className="relative h-[60vh] md:h-[70vh] flex items-center justify-center overflow-hidden">
              <img src="https://img.freepik.com/fotos-premium/jesus-cristo-crucificado-na-cruz-no-monte-golgota-morreu-pelos-pecados-da-humanidade-filho-de-deus-biblia-fe-natal-religiao-catolica-cristao-feliz-pascoa-rezando-boa-sexta-feira-generative-ai_930683-474.jpg?w=2000" className="absolute inset-0 w-full h-full object-cover" alt="Hero" />
              <div className="absolute inset-0 bg-slate-900/50"></div>
              <div className="relative text-center text-white px-6 max-w-2xl">
                <h2 className="text-3xl md:text-6xl font-serif mb-4 md:mb-6 leading-tight">Espiritualidade e Paz para o seu Lar</h2>
                <p className="text-base md:text-xl font-light mb-8 md:mb-10 italic opacity-90 font-body-serif">Artigos que conectam você ao sagrado, com a tradição e o cuidado que sua fé merece.</p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <button onClick={() => navigateToPage(Page.Catalog)} className="px-8 py-4 bg-amber-600 text-white font-black text-[10px] uppercase tracking-widest rounded-full hover:bg-amber-700 transition-all shadow-xl">Ver Catálogo</button>
                  <button onClick={() => navigateToPage(Page.Customizer)} className="px-8 py-4 bg-white/10 backdrop-blur-md border border-white/30 text-white font-black text-[10px] uppercase tracking-widest rounded-full hover:bg-white/20 transition-all">Monte seu Terço</button>
                </div>
              </div>
            </section>
            
            <section className="container mx-auto px-4 py-12 md:py-20 text-center">
               <span className="text-amber-600 font-bold text-[10px] uppercase tracking-[0.3em] mb-3 block">Destaques</span>
               <h3 className="text-2xl md:text-4xl font-serif text-slate-900 mb-8 md:mb-12">Artigos Selecionados</h3>
               <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 md:gap-10">
                  {products.filter(p => p.isFeatured).slice(0, 3).map(p => (
                    <div key={p.id} className="bg-white p-4 md:p-6 rounded-[24px] md:rounded-[32px] border border-slate-100 shadow-sm hover:shadow-xl transition-all group cursor-pointer" onClick={() => navigateToProduct(p)}>
                       <div className="aspect-[4/5] rounded-xl md:rounded-2xl overflow-hidden mb-4 md:mb-6">
                          <img src={p.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt={p.name} />
                       </div>
                       <h4 className="font-bold text-slate-800 mb-1 md:mb-2 text-sm md:text-base">{p.name}</h4>
                       <p className="text-amber-600 font-black text-xs md:text-sm">R$ {p.price.toFixed(2)}</p>
                    </div>
                  ))}
               </div>
            </section>
          </>
        )}

        {currentPage === Page.About && (
          <section className="container mx-auto px-6 py-12 md:py-20 animate-in fade-in duration-700">
            <div className="max-w-4xl mx-auto space-y-12 md:space-y-20">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 items-center">
                <div className="order-2 md:order-1">
                  <span className="text-amber-600 font-bold text-[10px] uppercase tracking-[0.4em] mb-4 md:mb-6 block">Nossa História</span>
                  <h2 className="text-3xl md:text-4xl font-serif text-slate-900 mb-6 md:mb-8 leading-tight">Onde a Fé Encontra a Tradição</h2>
                  <div className="space-y-4 md:space-y-6 text-slate-600 font-body-serif leading-relaxed italic text-base md:text-lg">
                    <p>A "Minha Santa Fonte" nasceu do desejo profundo de levar o sagrado para dentro dos lares brasileiros de forma autêntica e zelosa.</p>
                    <p>Cada artigo é selecionado ou confeccionado com a intenção de ser um instrumento de oração e uma lembrança constante da presença de Deus.</p>
                  </div>
                </div>
                <div className="relative order-1 md:order-2">
                  <div className="aspect-[4/5] rounded-[40px] md:rounded-[60px] overflow-hidden shadow-2xl">
                    <img src="https://images.unsplash.com/photo-1544427928-142f0685600b?auto=format&fit=crop&q=80&w=1000" className="w-full h-full object-cover" alt="História" />
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {currentPage === Page.Customizer && (
           <section className="container mx-auto px-4 py-12 md:py-20 max-w-6xl">
              <div className="text-center mb-10 md:mb-16">
                 <h2 className="text-3xl md:text-4xl font-serif mb-4">Monte seu Terço</h2>
                 <p className="text-slate-400 text-sm font-body-serif italic">Personalize cada detalhe do seu instrumento de oração.</p>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-12">
                 {/* Preview Mobile */}
                 <div className="lg:hidden">
                    <div className="bg-white rounded-[32px] shadow-sm border p-4 flex items-center justify-between">
                       <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-slate-50 rounded-lg overflow-hidden border">
                             {customSelections.crucifix ? <img src={customSelections.crucifix.image} className="w-full h-full object-cover" alt="Crucifixo" /> : <div className="p-3 text-slate-200"><IconCross /></div>}
                          </div>
                          <div>
                             <p className="text-[10px] font-black uppercase text-slate-400">Total Atual</p>
                             <p className="text-lg font-black text-slate-900">R$ {calculateCustomPrice().toFixed(2)}</p>
                          </div>
                       </div>
                       {customStep >= 4 && <button onClick={addCustomToCart} className="bg-amber-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase">Finalizar 🙏</button>}
                    </div>
                 </div>

                 <div className="lg:col-span-7 bg-white p-6 md:p-10 rounded-[32px] md:rounded-[40px] shadow-sm border border-slate-100 min-h-[400px]">
                    <div className="flex justify-between items-center mb-6 md:mb-8">
                      <h3 className="text-lg md:text-xl font-bold">Passo {customStep}: {customStep === 1 ? 'Material' : customStep === 2 ? 'Cor' : 'Crucifixo'}</h3>
                      {customStep > 1 && <button onClick={() => setCustomStep(s => s-1)} className="text-[10px] font-black uppercase text-slate-400 underline">Voltar</button>}
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                       {customStep === 1 && materials.map(m => (
                         <button key={m.id} onClick={() => {setCustomSelections({...customSelections, material: m}); setCustomStep(2);}} className="p-4 border-2 border-slate-50 rounded-2xl hover:border-amber-500 transition-all text-left flex items-center gap-4">
                            <img src={m.image} className="w-12 h-12 rounded-lg object-cover" alt={m.name} />
                            <div><p className="font-bold text-sm">{m.name}</p><p className="text-[9px] text-amber-600 font-black">+{m.price > 0 ? `R$ ${m.price.toFixed(2)}` : 'Incluso'}</p></div>
                         </button>
                       ))}
                       {customStep === 2 && colors.map(c => (
                         <button key={c.id} onClick={() => {setCustomSelections({...customSelections, color: c}); setCustomStep(3);}} className="p-4 border-2 border-slate-50 rounded-2xl hover:border-amber-500 transition-all text-left">
                            <p className="font-bold text-sm">{c.name}</p><p className="text-[9px] text-amber-600">+{c.price > 0 ? `R$ ${c.price.toFixed(2)}` : 'Incluso'}</p>
                         </button>
                       ))}
                       {customStep === 3 && crucifixes.map(x => (
                         <button key={x.id} onClick={() => {setCustomSelections({...customSelections, crucifix: x}); setCustomStep(4);}} className="p-4 border-2 border-slate-50 rounded-2xl hover:border-amber-500 transition-all text-left flex items-center gap-4">
                            <img src={x.image} className="w-12 h-12 rounded-lg object-cover" alt={x.name} />
                            <div><p className="font-bold text-sm">{x.name}</p><p className="text-[9px] text-amber-600 font-black">+{x.price > 0 ? `R$ ${x.price.toFixed(2)}` : 'Incluso'}</p></div>
                         </button>
                       ))}
                       {customStep >= 4 && (
                         <div className="col-span-full text-center py-6">
                            <div className="mb-6 bg-slate-50 rounded-2xl p-6 border border-dashed"><p className="italic text-sm text-slate-500">Peça confeccionada manualmente com zelo e oração.</p></div>
                            <button onClick={addCustomToCart} className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl hover:bg-amber-600 transition-all">Adicionar à Cesta 🙏</button>
                         </div>
                       )}
                    </div>
                 </div>

                 {/* Preview Desktop */}
                 <div className="hidden lg:flex lg:col-span-5 flex-col gap-6">
                    <div className="bg-white rounded-[40px] shadow-sm border overflow-hidden">
                       <div className="aspect-[4/5] bg-slate-50 relative flex items-center justify-center p-8">
                          {customSelections.material && <img src={customSelections.material.image} className="absolute inset-0 w-full h-full object-cover mix-blend-multiply opacity-80" alt="Contas" />}
                          {customSelections.crucifix && <img src={customSelections.crucifix.image} className="relative z-10 w-44 h-44 rounded-3xl border-4 border-white shadow-2xl object-cover" alt="X" />}
                       </div>
                       <div className="p-8 border-t">
                          <h4 className="text-[10px] font-black uppercase text-slate-400 mb-6">Confecção</h4>
                          <div className="space-y-4 text-sm">
                             <div className="flex justify-between"><span>Base Ateliê</span><span className="font-bold">R$ {baseRosaryPrice.toFixed(2)}</span></div>
                             {customSelections.material && <div className="flex justify-between font-bold text-slate-900"><span>{customSelections.material.name}</span><span className="text-amber-600">+{customSelections.material.price.toFixed(2)}</span></div>}
                             {customSelections.color && customSelections.color.price > 0 && <div className="flex justify-between font-bold text-slate-900"><span>Cor: {customSelections.color.name}</span><span className="text-amber-600">+{customSelections.color.price.toFixed(2)}</span></div>}
                             {customSelections.crucifix && <div className="flex justify-between font-bold text-slate-900"><span>{customSelections.crucifix.name}</span><span className="text-amber-600">+{customSelections.crucifix.price.toFixed(2)}</span></div>}
                             <div className="pt-6 border-t flex justify-between items-end">
                                <div><p className="text-[9px] font-black uppercase text-slate-400">Total</p><p className="text-3xl font-black text-slate-900">R$ {calculateCustomPrice().toFixed(2)}</p></div>
                             </div>
                          </div>
                       </div>
                    </div>
                 </div>
              </div>
           </section>
        )}

        {currentPage === Page.Catalog && (
          <section className="container mx-auto px-4 py-12 md:py-20">
             <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 md:mb-12 space-y-4 md:space-y-0">
                <h2 className="text-2xl md:text-3xl font-serif text-slate-900">Catálogo de Fé</h2>
                <div className="flex gap-2 overflow-x-auto w-full md:w-auto pb-2 no-scrollbar">
                   {CATEGORIES.map(c => <button key={c} onClick={() => setSelectedCategory(c)} className={`whitespace-nowrap px-4 py-2 rounded-full text-[9px] md:text-[10px] font-black uppercase tracking-widest border transition-all ${selectedCategory === c ? 'bg-slate-900 text-white shadow-lg border-slate-900' : 'bg-white text-slate-400 border-slate-100 hover:border-slate-300'}`}>{c}</button>)}
                </div>
             </div>
             <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 md:gap-8">
                {filteredProducts.map(p => (
                  <div key={p.id} className="group cursor-pointer" onClick={() => navigateToProduct(p)}>
                     <div className="aspect-square bg-white rounded-2xl md:rounded-3xl overflow-hidden mb-3 md:mb-4 border relative">
                        <img src={p.image} className="w-full h-full object-cover group-hover:scale-105 transition-all duration-500" alt={p.name} />
                        {p.stock === 0 && <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center text-white text-[9px] font-black uppercase">Esgotado</div>}
                     </div>
                     <h4 className="font-bold text-xs md:text-sm text-slate-800 truncate">{p.name}</h4>
                     <p className="text-amber-600 font-bold text-sm md:text-base">R$ {p.price.toFixed(2)}</p>
                  </div>
                ))}
             </div>
          </section>
        )}

        {currentPage === Page.Product && selectedProduct && (
          <section className="container mx-auto px-6 py-8 md:py-16">
            <button onClick={() => navigateToPage(Page.Catalog)} className="text-[10px] font-black uppercase text-slate-400 mb-8 hover:text-slate-900 transition-colors">← Voltar ao Catálogo</button>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-16 items-start">
              <div className="lg:col-span-7 flex flex-col gap-4">
                <div className="aspect-square rounded-[32px] md:rounded-[48px] overflow-hidden bg-white border border-slate-100 shadow-sm relative">
                   <img 
                    src={selectedVariant?.image || selectedProduct.images?.[activeImageIndex] || selectedProduct.image} 
                    className="w-full h-full object-cover transition-all duration-700 ease-in-out" 
                    alt={selectedProduct.name} 
                   />
                   {selectedVariant?.image && (
                      <div className="absolute top-4 right-4 bg-amber-600/90 text-white px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest backdrop-blur-sm">
                        Opção: {selectedVariant.name}
                      </div>
                   )}
                </div>
                <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
                  {(selectedProduct.images || [selectedProduct.image]).map((img, idx) => (
                    <button 
                      key={idx} 
                      onClick={() => {setActiveImageIndex(idx); setSelectedVariant(null);}} 
                      className={`w-16 h-16 md:w-20 md:h-20 rounded-xl overflow-hidden border-2 flex-shrink-0 transition-all ${activeImageIndex === idx && !selectedVariant ? 'border-amber-600 scale-95' : 'border-transparent opacity-60 hover:opacity-100'}`}
                    >
                      <img src={img} className="w-full h-full object-cover" alt="galeria" />
                    </button>
                  ))}
                </div>
              </div>
              <div className="lg:col-span-5 space-y-6 md:space-y-10">
                <div>
                   <span className="text-amber-600 font-black text-[9px] uppercase tracking-[0.3em] mb-2 block">{selectedProduct.category}</span>
                   <h2 className="text-2xl md:text-4xl font-serif text-slate-900 mb-4">{selectedProduct.name}</h2>
                   <div className="flex items-center space-x-4">
                      <h3 className="text-2xl md:text-3xl font-black text-slate-900">R$ {(selectedProduct.price + (selectedVariant?.priceDelta || 0)).toFixed(2)}</h3>
                   </div>
                </div>
                {selectedProduct.variants && selectedProduct.variants.length > 0 && (
                   <div className="space-y-3">
                      <h4 className="text-[9px] font-black uppercase tracking-widest text-slate-400">Variantes</h4>
                      <div className="flex flex-wrap gap-2">
                         {selectedProduct.variants.map((v, i) => (
                            <button 
                              key={i} 
                              onClick={() => setSelectedVariant(v)} 
                              className={`px-4 py-3 rounded-xl text-[10px] font-bold transition-all border flex items-center gap-2 ${selectedVariant?.name === v.name ? 'border-amber-600 bg-amber-50 text-amber-700 ring-2 ring-amber-600/20' : 'border-slate-100 bg-white text-slate-400 hover:border-slate-300'}`}
                            >
                               {v.image && <img src={v.image} className="w-5 h-5 rounded-full object-cover border" alt="" />}
                               {v.name}
                            </button>
                         ))}
                      </div>
                   </div>
                )}
                <div className="space-y-3">
                   <h4 className="text-[9px] font-black uppercase tracking-widest text-slate-400">Sobre este Artigo</h4>
                   <p className="text-slate-600 font-body-serif italic text-sm md:text-base leading-relaxed">{selectedProduct.description}</p>
                </div>
                <div className="p-6 bg-slate-100 rounded-3xl border border-slate-200">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Disponibilidade</p>
                  <p className={`text-sm font-bold ${selectedProduct.stock > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {selectedProduct.stock > 0 ? `${selectedProduct.stock} unidades em estoque` : 'Produto Indisponível'}
                  </p>
                </div>
                <button 
                  onClick={() => addToCart(selectedProduct)} 
                  disabled={selectedProduct.stock <= 0} 
                  className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:bg-amber-600 disabled:bg-slate-300 transition-all active:scale-95"
                >
                  Adicionar à Cesta 🙏
                </button>
              </div>
            </div>
          </section>
        )}

        {/* --- DASHBOARD ADMINISTRATIVO REFINADO --- */}
        {currentPage === Page.AdminDashboard && isAdmin && (
           <div className="min-h-screen bg-[#f8fafc] flex flex-col lg:flex-row font-sans">
              {/* Sidebar Moderna */}
              <aside className="w-full lg:w-72 bg-[#0a0f1a] text-white p-6 lg:p-10 flex flex-col shrink-0 border-r border-white/5">
                 <div className="flex items-center justify-between lg:justify-start lg:gap-3 mb-12">
                    <div className="flex items-center space-x-2 text-amber-500"><IconCross /></div>
                    <div className="leading-tight">
                      <span className="block font-bold tracking-tighter text-lg uppercase">Admin MSF</span>
                      <span className="text-[8px] uppercase tracking-[0.3em] text-amber-500 font-bold">Painel de Controle</span>
                    </div>
                 </div>
                 
                 <nav className="flex flex-row lg:flex-col gap-2 overflow-x-auto no-scrollbar lg:space-y-1 mb-auto">
                    {[
                      { id: 'products', label: 'Artigos', icon: '🛍️' },
                      { id: 'stock', label: 'Estoque', icon: '📦' },
                      { id: 'customizer', label: 'Customização', icon: '🎨' },
                      { id: 'blog', label: 'Blog', icon: '✍️' }
                    ].map(tab => (
                      <button 
                        key={tab.id} 
                        onClick={() => setAdminTab(tab.id as any)} 
                        className={`whitespace-nowrap flex items-center gap-3 px-5 py-3.5 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-all ${adminTab === tab.id ? 'bg-amber-600 text-white shadow-[0_10px_20px_-5px_rgba(217,119,6,0.4)]' : 'text-slate-400 hover:bg-white/5'}`}
                      >
                        <span className="text-base">{tab.icon}</span>
                        {tab.label}
                      </button>
                    ))}
                 </nav>
                 
                 <div className="mt-8 pt-8 border-t border-white/5 space-y-4">
                    <button onClick={() => navigateToPage(Page.Home)} className="w-full text-left px-5 py-3 text-[9px] font-black uppercase text-slate-500 hover:text-white transition-colors">Voltar ao Site</button>
                    <button onClick={() => { setIsAdmin(false); navigateToPage(Page.Home); }} className="w-full flex items-center justify-center gap-2 py-4 bg-red-500/10 text-red-400 text-[10px] font-black uppercase rounded-2xl hover:bg-red-500 hover:text-white transition-all border border-red-500/20">Sair</button>
                 </div>
              </aside>

              <section className="flex-grow p-4 md:p-8 lg:p-12 overflow-y-auto">
                 <div className="max-w-6xl mx-auto">
                    {/* Header Contextual */}
                    <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
                       <div>
                          <h3 className="text-2xl md:text-3xl font-serif text-slate-900 capitalize">{adminTab === 'products' ? (editingProduct ? 'Editando Artigo' : 'Novo Artigo') : adminTab === 'stock' ? 'Gestão de Inventário' : adminTab === 'customizer' ? 'Configuração de Personalização' : 'Blog do Ateliê'}</h3>
                          <p className="text-slate-400 text-xs mt-1 font-body-serif italic">Organize sua loja com cuidado e atenção aos detalhes.</p>
                       </div>
                       {adminTab === 'products' && editingProduct && (
                          <button onClick={() => {
                            setEditingProduct(null);
                            setNewProduct({ name: '', category: CATEGORIES[1], price: 0, stock: 10, description: '', images: [], variants: [], isFeatured: false });
                          }} className="flex items-center gap-2 px-4 py-2 bg-slate-200 text-slate-600 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-slate-300 transition-all">
                            <IconX /> Cancelar Edição
                          </button>
                       )}
                    </div>

                    {/* Conteúdo Dinâmico com Cards Refinados */}
                    {adminTab === 'products' && (
                      <div className="bg-white p-6 md:p-10 rounded-[32px] shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] border border-slate-100">
                        <form onSubmit={handleSaveProduct} className="space-y-10">
                          {/* Sessão: Informações Principais */}
                          <div className="space-y-6">
                            <div className="flex items-center gap-3 border-b border-slate-50 pb-3">
                               <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center text-xs">1</div>
                               <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-400">Informações Básicas</h4>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div className="space-y-1.5">
                                <label className="text-[9px] font-black uppercase text-slate-500 ml-1">Nome do Produto</label>
                                <input type="text" placeholder="Ex: Terço de Madeira Nobre" value={newProduct.name || ''} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all" onChange={e => setNewProduct(p => ({ ...p, name: e.target.value }))} required />
                              </div>
                              <div className="space-y-1.5">
                                <label className="text-[9px] font-black uppercase text-slate-500 ml-1">Categoria</label>
                                <select value={newProduct.category} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all" onChange={e => setNewProduct(p => ({ ...p, category: e.target.value }))}>
                                  {CATEGORIES.slice(1).map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                              </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                              <div className="space-y-1.5">
                                <label className="text-[9px] font-black uppercase text-slate-500 ml-1">Preço Base (R$)</label>
                                <input type="number" step="0.01" value={newProduct.price || 0} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all" onChange={e => setNewProduct(p => ({ ...p, price: Number(e.target.value) }))} required />
                              </div>
                              <div className="space-y-1.5">
                                <label className="text-[9px] font-black uppercase text-slate-500 ml-1">Estoque</label>
                                <input type="number" value={newProduct.stock || 0} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all" onChange={e => setNewProduct(p => ({ ...p, stock: Number(e.target.value) }))} required />
                              </div>
                              <div className="flex items-center gap-3 pt-6">
                                <input type="checkbox" id="featured-admin" checked={newProduct.isFeatured} onChange={e => setNewProduct(p => ({ ...p, isFeatured: e.target.checked }))} className="w-5 h-5 accent-amber-600 rounded cursor-pointer" />
                                <label htmlFor="featured-admin" className="text-[10px] font-black uppercase text-slate-600 cursor-pointer">Artigo em Destaque</label>
                              </div>
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[9px] font-black uppercase text-slate-500 ml-1">Descrição</label>
                              <textarea rows={3} placeholder="Descreva os materiais, o significado e detalhes técnicos..." value={newProduct.description || ''} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all" onChange={e => setNewProduct(p => ({ ...p, description: e.target.value }))} required />
                            </div>
                          </div>

                          {/* Sessão: Galeria */}
                          <div className="space-y-6">
                            <div className="flex items-center gap-3 border-b border-slate-50 pb-3">
                               <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center text-xs">2</div>
                               <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-400">Galeria de Imagens</h4>
                            </div>
                            <div className="flex gap-3">
                                <input type="text" placeholder="Cole a URL da imagem aqui..." value={tempImageUrl} className="flex-grow p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-amber-500/20" onChange={e => setTempImageUrl(e.target.value)} />
                                <button type="button" onClick={addImageUrlToProduct} className="px-6 bg-slate-900 text-white rounded-2xl hover:bg-amber-600 transition-all shadow-lg active:scale-95"><IconPlus /></button>
                            </div>
                            <div className="flex flex-wrap gap-4">
                               {newProduct.images?.map((img, idx) => (
                                  <div key={idx} className="relative w-24 h-24 group">
                                     <img src={img} className="w-full h-full object-cover rounded-2xl border border-slate-100 shadow-sm" alt="preview" />
                                     <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl flex items-center justify-center">
                                       <button type="button" onClick={() => removeImageFromProduct(idx)} className="bg-red-500 text-white p-2 rounded-full shadow-lg"><IconTrash /></button>
                                     </div>
                                     {idx === 0 && <span className="absolute -top-2 -left-2 bg-amber-600 text-white text-[7px] font-black px-2 py-1 rounded-full shadow-md uppercase">Capa</span>}
                                  </div>
                               ))}
                               {(!newProduct.images || newProduct.images.length === 0) && (
                                  <div className="w-24 h-24 border-2 border-dashed border-slate-200 rounded-2xl flex items-center justify-center text-slate-300">
                                     <span className="text-[8px] font-black uppercase">Vazio</span>
                                  </div>
                               )}
                            </div>
                          </div>

                          {/* Sessão: Variantes Avançadas */}
                          <div className="space-y-6">
                            <div className="flex items-center gap-3 border-b border-slate-50 pb-3">
                               <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center text-xs">3</div>
                               <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-400">Variações e Fotos</h4>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-50/50 p-6 rounded-3xl border border-slate-100">
                                <div className="sm:col-span-1 space-y-1">
                                   <label className="text-[8px] font-black uppercase text-slate-400 ml-1">Nome</label>
                                   <input type="text" placeholder="Ex: Azul" value={tempVariantName} className="w-full p-3 bg-white border border-slate-100 rounded-xl outline-none" onChange={e => setTempVariantName(e.target.value)} />
                                </div>
                                <div className="sm:col-span-1 space-y-1">
                                   <label className="text-[8px] font-black uppercase text-slate-400 ml-1">Preço Extra</label>
                                   <input type="number" step="0.01" placeholder="0.00" value={tempVariantPrice} className="w-full p-3 bg-white border border-slate-100 rounded-xl outline-none" onChange={e => setTempVariantPrice(Number(e.target.value))} />
                                </div>
                                <div className="sm:col-span-1 space-y-1">
                                   <label className="text-[8px] font-black uppercase text-slate-400 ml-1">URL da Foto</label>
                                   <input type="text" placeholder="https://..." value={tempVariantImage} className="w-full p-3 bg-white border border-slate-100 rounded-xl outline-none" onChange={e => setTempVariantImage(e.target.value)} />
                                </div>
                                <div className="pt-5 flex items-end">
                                   <button type="button" onClick={addVariantToProduct} className="w-full p-3.5 bg-slate-800 text-white rounded-xl font-bold uppercase text-[9px] hover:bg-amber-600 transition-all active:scale-95">Adicionar Variante</button>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                {newProduct.variants?.map((v, idx) => (
                                   <div key={idx} className="flex flex-col p-3 bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                                      <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg overflow-hidden border">
                                           {v.image ? <img src={v.image} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full bg-slate-100" />}
                                        </div>
                                        <div className="flex-grow">
                                           <p className="font-bold text-xs truncate">{v.name}</p>
                                           <p className="text-[9px] text-amber-600 font-black">+ R$ {v.priceDelta.toFixed(2)}</p>
                                        </div>
                                        <button type="button" onClick={() => removeVariantFromProduct(idx)} className="text-red-400 hover:text-red-600 p-1 opacity-0 group-hover:opacity-100 transition-opacity"><IconTrash /></button>
                                      </div>
                                   </div>
                                ))}
                            </div>
                          </div>

                          <div className="pt-6">
                            <button type="submit" className="w-full py-6 bg-amber-600 text-white rounded-3xl font-black text-xs uppercase tracking-[0.3em] shadow-[0_15px_30px_-5px_rgba(217,119,6,0.4)] hover:bg-amber-700 transition-all transform hover:-translate-y-1 active:translate-y-0">
                               {editingProduct ? 'Confirmar Alterações 🙏' : 'Publicar no Catálogo 🙏'}
                            </button>
                          </div>
                        </form>
                      </div>
                    )}

                    {adminTab === 'stock' && (
                      <div className="bg-white rounded-[32px] shadow-sm border border-slate-100 overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs md:text-sm">
                            <thead className="bg-[#0a0f1a] text-[9px] font-black uppercase text-slate-500 tracking-widest border-b border-white/5">
                              <tr>
                                <th className="p-6">Produto</th>
                                <th className="p-6">Categoria</th>
                                <th className="p-6 text-center">Preço</th>
                                <th className="p-6 text-center">Disponibilidade</th>
                                <th className="p-6 text-right">Controle</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                              {products.map(p => (
                                <tr key={p.id} className="hover:bg-slate-50 transition-colors group">
                                  <td className="p-6">
                                    <div className="flex items-center space-x-4">
                                       <img src={p.image} className="w-12 h-12 rounded-xl object-cover shadow-sm" alt="p" />
                                       <div>
                                          <p className="font-bold text-slate-800 text-sm">{p.name}</p>
                                          <p className="text-[8px] uppercase tracking-widest text-slate-400">ID: {p.id}</p>
                                       </div>
                                    </div>
                                  </td>
                                  <td className="p-6">
                                     <span className="bg-slate-100 text-slate-500 px-3 py-1 rounded-lg text-[9px] font-black uppercase">{p.category}</span>
                                  </td>
                                  <td className="p-6 text-center font-bold text-slate-900">R$ {p.price.toFixed(2)}</td>
                                  <td className="p-6 text-center">
                                    <div className="flex flex-col items-center">
                                       <span className={`px-3 py-1 rounded-full font-black text-[10px] ${p.stock <= 2 ? 'bg-red-50 text-red-600' : p.stock <= 5 ? 'bg-amber-50 text-amber-600' : 'bg-green-50 text-green-600'}`}>
                                          {p.stock} un
                                       </span>
                                    </div>
                                  </td>
                                  <td className="p-6 text-right">
                                    <div className="flex justify-end gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                                       <div className="flex border rounded-xl overflow-hidden mr-4">
                                          <button onClick={() => updateStock(p.id, -1)} className="p-2 px-3 bg-white hover:bg-slate-50 border-r text-slate-400 hover:text-red-500">-</button>
                                          <button onClick={() => updateStock(p.id, 1)} className="p-2 px-3 bg-white hover:bg-slate-50 text-slate-400 hover:text-green-500">+</button>
                                       </div>
                                       <button onClick={() => startEditingProduct(p)} className="p-3 bg-slate-900 text-white rounded-xl hover:bg-amber-600 transition-all shadow-sm" title="Editar"><IconEdit /></button>
                                       <button onClick={() => deleteProduct(p.id)} className="p-3 bg-red-50 text-red-500 border border-red-100 rounded-xl hover:bg-red-500 hover:text-white transition-all shadow-sm" title="Excluir"><IconTrash /></button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {adminTab === 'customizer' && (
                       <div className="space-y-10">
                          {/* Card de Configuração Global Refinado */}
                          <div className="bg-[#0a0f1a] text-white p-8 md:p-12 rounded-[40px] shadow-2xl relative overflow-hidden group">
                             <div className="absolute top-0 right-0 w-64 h-64 bg-amber-600/10 rounded-full -mr-20 -mt-20 blur-3xl group-hover:bg-amber-600/20 transition-all"></div>
                             <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
                                <div className="space-y-3 text-center md:text-left">
                                   <div className="inline-flex items-center gap-2 bg-amber-600/20 text-amber-500 px-4 py-2 rounded-full text-[9px] font-black uppercase tracking-widest mb-2 border border-amber-600/30">Valor de Confecção</div>
                                   <h4 className="text-3xl md:text-4xl font-serif leading-none">Preço de Partida do Terço</h4>
                                   <p className="text-slate-400 text-xs font-body-serif italic">Valor base do Ateliê antes das escolhas de materiais</p>
                                </div>
                                <div className="flex items-center gap-4 bg-white/5 p-6 rounded-[32px] border border-white/10 shadow-inner">
                                   <span className="text-3xl font-black text-amber-500">R$</span>
                                   <input 
                                    type="number" 
                                    step="0.01" 
                                    value={baseRosaryPrice} 
                                    className="bg-transparent text-5xl font-black text-white w-32 outline-none border-b-2 border-white/20 focus:border-amber-500 transition-all" 
                                    onChange={e => saveBasePrice(Number(e.target.value))} 
                                   />
                                </div>
                             </div>
                          </div>

                          {/* Formulário de Opção Refinado */}
                          <div className="bg-white p-8 md:p-10 rounded-[40px] shadow-sm border border-slate-100">
                             <h4 className="text-[11px] font-black uppercase text-slate-400 tracking-[0.3em] mb-8 flex items-center gap-4">
                                <span className="w-8 h-px bg-slate-200"></span>
                                {editingCustomOption.option ? 'Editando Opção' : 'Cadastrar Elemento de Terço'}
                                <span className="flex-grow h-px bg-slate-200"></span>
                             </h4>
                             <form onSubmit={handleSaveCustomOption} className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                   <div className="space-y-1.5">
                                      <label className="text-[9px] font-black uppercase text-slate-500 ml-1">Tipo de Elemento</label>
                                      <select className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500" value={editingCustomOption.type} onChange={e => setEditingCustomOption(prev => ({...prev, type: e.target.value as any}))} required>
                                         <option value="">Escolha...</option>
                                         <option value="material">Contas (Material)</option>
                                         <option value="color">Cor Principal</option>
                                         <option value="crucifix">Crucifixo / Cruz</option>
                                      </select>
                                   </div>
                                   <div className="space-y-1.5">
                                      <label className="text-[9px] font-black uppercase text-slate-500 ml-1">Nome da Peça</label>
                                      <input type="text" placeholder="Ex: Ametista Lapidada" value={tempCustomOption.name || ''} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-amber-500/20" onChange={e => setTempCustomOption({...tempCustomOption, name: e.target.value})} required />
                                   </div>
                                   <div className="space-y-1.5">
                                      <label className="text-[9px] font-black uppercase text-slate-500 ml-1">Custo Adicional (R$)</label>
                                      <input type="number" step="0.01" placeholder="0.00" value={tempCustomOption.price || 0} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-amber-500/20" onChange={e => setTempCustomOption({...tempCustomOption, price: Number(e.target.value)})} />
                                   </div>
                                   <div className="pt-5">
                                      <button type="submit" className="w-full h-[58px] bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl hover:bg-amber-600 transition-all active:scale-95">Salvar 🙏</button>
                                   </div>
                                </div>
                                {(editingCustomOption.type === 'material' || editingCustomOption.type === 'crucifix') && (
                                  <div className="space-y-2 bg-slate-50 p-6 rounded-3xl border border-dashed border-slate-200">
                                    <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Link da Foto (Necessário para prévia visual)</label>
                                    <input type="text" placeholder="https://unsplash.com/foto-do-item" value={tempCustomOption.image || ''} className="w-full p-4 bg-white border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-amber-500/20" onChange={e => setTempCustomOption({...tempCustomOption, image: e.target.value})} />
                                  </div>
                                )}
                             </form>
                          </div>

                          {/* Listagens em Colunas Refinadas */}
                          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                             {[
                               { title: 'Contas', data: materials, type: 'material' },
                               { title: 'Cores', data: colors, type: 'color' },
                               { title: 'Crucifixos', data: crucifixes, type: 'crucifix' }
                             ].map(col => (
                                <div key={col.type} className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex flex-col">
                                   <h5 className="font-black text-[10px] uppercase text-slate-400 tracking-[0.3em] mb-6 border-b border-slate-50 pb-4 text-center">{col.title} ({col.data.length})</h5>
                                   <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 no-scrollbar">
                                      {col.data.map(item => (
                                         <div key={item.id} className="group p-4 bg-slate-50 hover:bg-white rounded-[24px] border border-transparent hover:border-slate-100 hover:shadow-lg transition-all flex items-center justify-between">
                                            <div className="flex items-center gap-3 truncate">
                                               {item.image && <img src={item.image} className="w-10 h-10 rounded-xl object-cover border border-white shadow-sm" alt="" />}
                                               <div className="truncate">
                                                  <p className="font-bold text-slate-800 text-xs truncate">{item.name}</p>
                                                  <p className="text-[9px] text-amber-600 font-black">+ R$ {item.price.toFixed(2)}</p>
                                               </div>
                                            </div>
                                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                               <button onClick={() => startEditingCustomOption(col.type as any, item)} className="p-2 bg-white text-amber-600 rounded-lg shadow-sm hover:bg-amber-50"><IconEdit /></button>
                                               <button onClick={() => deleteCustomOption(col.type as any, item.id)} className="p-2 bg-white text-red-500 rounded-lg shadow-sm hover:bg-red-50"><IconTrash /></button>
                                            </div>
                                         </div>
                                      ))}
                                      {col.data.length === 0 && <p className="text-center py-10 text-slate-300 text-[10px] font-black uppercase tracking-widest italic">Nenhuma opção</p>}
                                   </div>
                                </div>
                             ))}
                          </div>
                       </div>
                    )}
                    
                    {adminTab === 'blog' && (
                      <div className="bg-white p-20 rounded-[40px] text-center border-2 border-dashed border-slate-100">
                        <div className="text-5xl mb-6">✍️</div>
                        <h4 className="text-xl font-serif text-slate-900 mb-2">Módulo de Blog</h4>
                        <p className="text-slate-400 italic font-body-serif max-w-sm mx-auto">Em breve você poderá publicar artigos, reflexões e orações para conectar-se ainda mais com seus fiéis clientes.</p>
                      </div>
                    )}
                 </div>
              </section>
           </div>
        )}

        {currentPage === Page.AdminLogin && (
           <section className="container mx-auto px-6 py-12 flex items-center justify-center min-h-[60vh]">
              <div className="bg-white p-8 md:p-16 rounded-[40px] md:rounded-[60px] shadow-2xl border border-slate-100 max-w-md w-full text-center">
                 <h2 className="text-2xl md:text-3xl font-serif text-slate-900 mb-8 tracking-tighter uppercase">Identificação Admin</h2>
                 <form onSubmit={handleAdminLogin} className="space-y-4 md:space-y-6">
                    <input name="user" type="text" className="w-full p-4 md:p-5 bg-slate-50 border border-slate-100 rounded-2xl md:rounded-3xl outline-none focus:border-amber-500 transition-all text-center" placeholder="Usuário" required />
                    <input name="pass" type="password" className="w-full p-4 md:p-5 bg-slate-50 border border-slate-100 rounded-2xl md:rounded-3xl outline-none focus:border-amber-500 transition-all text-center" placeholder="Senha" required />
                    {loginError && <p className="text-red-500 text-[10px] font-black uppercase tracking-widest">{loginError}</p>}
                    <button type="submit" className="w-full py-4 md:py-5 bg-slate-900 text-white rounded-2xl md:rounded-3xl font-black text-xs tracking-[0.3em] shadow-xl hover:bg-amber-600 transition-all uppercase">Autenticar 🙏</button>
                 </form>
              </div>
           </section>
        )}
      </main>

      <footer className="bg-[#0a0f1a] text-slate-400 py-12 md:py-20 px-6 border-t border-white/5">
        <div className="container mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-12 md:mb-20 text-center md:text-left">
          <div className="space-y-4 md:space-y-6 flex flex-col items-center md:items-start">
            <div className="flex items-center space-x-3 text-white">
              <span className="text-amber-500 text-3xl md:text-4xl font-light transition-transform hover:rotate-12 cursor-default">+</span>
              <h2 className="text-xl md:text-2xl font-serif tracking-tighter leading-tight">MINHA SANTA<br/>FONTE</h2>
            </div>
            <p className="font-body-serif italic text-xs md:text-sm leading-relaxed opacity-60 max-w-xs">Transformando espaços comuns em lugares de oração e contemplação através da arte sacra.</p>
          </div>
          <div className="hidden md:block">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mb-8">Navegação</h3>
            <ul className="space-y-4 text-[11px] font-bold uppercase tracking-widest">
              <li><button onClick={() => navigateToPage(Page.Home)} className="hover:text-white transition-colors">Início</button></li>
              <li><button onClick={() => navigateToPage(Page.Catalog)} className="hover:text-white transition-colors">Catálogo</button></li>
              <li><button onClick={() => navigateToPage(Page.Customizer)} className="hover:text-white transition-colors">Monte seu Terço</button></li>
              <li><button onClick={() => navigateToPage(Page.About)} className="hover:text-white transition-colors">Sobre Nós</button></li>
              <li><button onClick={() => navigateToPage(Page.AdminLogin)} className="text-amber-600 hover:text-amber-500 transition-colors">Administração</button></li>
            </ul>
          </div>
          <div>
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mb-6 md:mb-8">Atendimento</h3>
            <ul className="space-y-4 text-[11px] font-medium tracking-wide">
              <li>atendimento@minhasantafonte.com</li>
              <li>(11) 98765-4321</li>
              <li className="pt-4 text-[9px] font-black uppercase opacity-40">Seg a Sex, 09h às 18h</li>
            </ul>
          </div>
          <div>
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mb-6 md:mb-8">Fique Conectado</h3>
            <div className="flex bg-white/5 rounded-2xl overflow-hidden p-1 border border-white/5">
              <input type="email" placeholder="Seu melhor e-mail" className="bg-transparent border-none outline-none px-4 py-2 text-[10px] flex-grow text-white" />
              <button className="bg-amber-600 text-white px-5 py-2 text-[9px] font-black uppercase rounded-xl hover:bg-amber-700 transition-all">Assinar</button>
            </div>
            <p className="text-[8px] font-medium mt-3 opacity-40 uppercase tracking-widest text-center md:text-left">Receba novidades e orações exclusivas.</p>
          </div>
        </div>
        <div className="container mx-auto pt-10 border-t border-white/5 flex flex-col md:flex-row justify-between items-center text-[9px] font-black uppercase tracking-[0.2em] opacity-40">
          <p>© 2024-2026 MINHA SANTA FONTE | CNPJ 00.000.000/0001-00</p>
          <div className="flex space-x-6 mt-4 md:mt-0">
            <span className="hover:text-white cursor-pointer transition-colors">Privacidade</span>
            <span className="hover:text-white cursor-pointer transition-colors">Termos de Uso</span>
          </div>
        </div>
      </footer>

      {/* Botão Flutuante WhatsApp Refinado */}
      <a 
        href="https://wa.me/5511987654321?text=Olá! Gostaria de saber mais sobre os artigos da Minha Santa Fonte." 
        target="_blank" 
        rel="noopener noreferrer" 
        className="fixed bottom-6 right-6 md:bottom-10 md:right-10 z-50 bg-[#22c55e] w-14 h-14 md:w-20 md:h-20 rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all group"
      >
        <div className="absolute -top-10 right-0 bg-white text-[#22c55e] px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-300 translate-y-2 group-hover:translate-y-0">Fale Conosco</div>
        <IconWhatsApp />
      </a>

      {/* Carrinho Overlay Refinado */}
      {isCartOpen && (
        <div className="fixed inset-0 z-[60] flex justify-end">
           <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-500" onClick={() => setIsCartOpen(false)}></div>
           <div className="relative w-full max-w-sm md:max-w-md bg-white h-full shadow-2xl p-6 md:p-12 flex flex-col animate-in slide-in-from-right duration-500 ease-out">
              <div className="flex justify-between items-center mb-12">
                 <div>
                    <h3 className="text-2xl md:text-3xl font-serif text-slate-900 leading-tight">Sua Cesta</h3>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1">{cartCount} Artigos selecionados</p>
                 </div>
                 <button onClick={() => setIsCartOpen(false)} className="p-3 bg-slate-50 rounded-full hover:bg-slate-100 transition-colors"><IconX /></button>
              </div>
              <div className="flex-grow overflow-y-auto space-y-6 pr-2 no-scrollbar">
                 {cart.length === 0 ? (
                    <div className="text-center py-20">
                       <div className="text-6xl mb-6 opacity-20">🛒</div>
                       <p className="text-slate-400 italic font-body-serif text-lg">Sua cesta está vazia no momento...</p>
                       <button onClick={() => {setIsCartOpen(false); navigateToPage(Page.Catalog);}} className="mt-8 text-[10px] font-black uppercase tracking-widest text-amber-600 border-b-2 border-amber-600 pb-1">Ver Artigos do Catálogo</button>
                    </div>
                 ) : cart.map((item, idx) => (
                   <div key={`${item.id}-${idx}`} className="flex gap-5 group animate-in slide-in-from-bottom duration-300" style={{ animationDelay: `${idx * 100}ms` }}>
                      <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl overflow-hidden shadow-sm border border-slate-100 shrink-0">
                         <img src={item.image} className="w-full h-full object-cover transition-transform group-hover:scale-110" alt="item" />
                      </div>
                      <div className="flex-grow min-w-0">
                         <h4 className="font-bold text-sm text-slate-800 truncate mb-0.5">{item.name}</h4>
                         {item.selectedVariant && (
                            <p className="text-[9px] font-black uppercase text-slate-400 mb-1">Opção: {item.selectedVariant.name}</p>
                         )}
                         <p className="text-amber-600 font-bold text-sm">R$ {item.price.toFixed(2)}</p>
                      </div>
                      <button onClick={() => removeFromCart(item.id, item.selectedVariant?.name)} className="text-[9px] text-red-400 font-black uppercase tracking-widest h-fit mt-1 hover:text-red-600 transition-colors">Excluir</button>
                   </div>
                 ))}
              </div>
              <div className="pt-8 border-t border-slate-50 mt-8 space-y-6">
                 <div className="flex justify-between items-end">
                    <div>
                       <span className="text-[10px] uppercase tracking-widest text-slate-400 block mb-1">Subtotal</span>
                       <span className="text-3xl font-black text-slate-900">R$ {cartTotal.toFixed(2)}</span>
                    </div>
                 </div>
                 <button className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-[0.3em] shadow-[0_15px_30px_-5px_rgba(15,23,42,0.3)] hover:bg-amber-600 transition-all active:scale-95">Finalizar Pedido 🙏</button>
                 <p className="text-[8px] font-black uppercase text-slate-400 text-center tracking-[0.2em]">Pagamento Seguro via PIX ou Cartão</p>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default App;
