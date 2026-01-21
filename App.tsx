
import React, { useState, useMemo, useEffect } from 'react';
import { Product, Article, CartItem, Page, CustomRosary, ProductVariant, RosaryOption } from './types';
import { 
  PRODUCTS as INITIAL_PRODUCTS, 
  CATEGORIES, 
  ROSARY_MATERIALS as INITIAL_MATERIALS,
  ROSARY_COLORS as INITIAL_COLORS,
  ROSARY_CRUCIFIXES as INITIAL_CRUCIFIXES
} from './constants';

const BASE_ROSARY_PRICE = 40.00;

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
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  // --- Inicialização ---
  useEffect(() => {
    const savedProducts = localStorage.getItem('minha_santa_fonte_db_products');
    if (savedProducts) {
      setProducts(JSON.parse(savedProducts));
    } else {
      const initialized = INITIAL_PRODUCTS.map(p => ({ ...p, images: p.images || [p.image], createdAt: Date.now() }));
      setProducts(initialized);
      localStorage.setItem('minha_santa_fonte_db_products', JSON.stringify(initialized));
    }

    const savedMaterials = localStorage.getItem('msf_custom_materials');
    setMaterials(savedMaterials ? JSON.parse(savedMaterials) : INITIAL_MATERIALS);
    
    const savedColors = localStorage.getItem('msf_custom_colors');
    setColors(savedColors ? JSON.parse(savedColors) : INITIAL_COLORS);
    
    const savedCrucifixes = localStorage.getItem('msf_custom_crucifixes');
    setCrucifixes(savedCrucifixes ? JSON.parse(savedCrucifixes) : INITIAL_CRUCIFIXES);
  }, []);

  const saveProductsToDB = (updatedList: Product[]) => {
    setProducts([...updatedList]);
    localStorage.setItem('minha_santa_fonte_db_products', JSON.stringify(updatedList));
  };

  const saveCustomOptions = (type: 'material' | 'color' | 'crucifix', list: RosaryOption[]) => {
    const key = `msf_custom_${type}s`;
    localStorage.setItem(key, JSON.stringify(list));
    if (type === 'material') setMaterials([...list]);
    if (type === 'color') setColors([...list]);
    if (type === 'crucifix') setCrucifixes([...list]);
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
    let total = BASE_ROSARY_PRICE;
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
        variants: [...(p.variants || []), { name: tempVariantName.trim(), priceDelta: tempVariantPrice }] 
      })); 
      setTempVariantName(""); 
      setTempVariantPrice(0); 
    } 
  };

  const removeVariantFromProduct = (index: number) => {
    setNewProduct(p => ({
      ...p,
      variants: p.variants?.filter((_, i) => i !== index)
    }));
  };

  // --- Funções do Customizador no Admin ---
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

  const navigateToProduct = (product: Product) => { setSelectedProduct(product); setSelectedVariant(null); setActiveImageIndex(0); setCurrentPage(Page.Product); setIsMenuOpen(false); window.scrollTo(0, 0); };
  const navigateToPage = (page: Page) => { setCurrentPage(page); setIsMenuOpen(false); window.scrollTo(0, 0); };

  // --- Ícones ---
  const IconCross = () => <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M11 2h2v7h7v2h-7v11h-2v-11h-7v-2h7v-7z" /></svg>;
  const IconCart = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>;
  const IconMenu = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7" /></svg>;
  const IconX = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>;
  const IconPlus = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>;
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
                             <div className="flex justify-between"><span>Base Ateliê</span><span className="font-bold">R$ 40.00</span></div>
                             {customSelections.material && <div className="flex justify-between font-bold text-slate-900"><span>{customSelections.material.name}</span><span className="text-amber-600">+{customSelections.material.price.toFixed(2)}</span></div>}
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
                <h2 className="text-2xl md:text-3xl font-serif">Catálogo de Fé</h2>
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
            <button onClick={() => navigateToPage(Page.Catalog)} className="text-[10px] font-black uppercase text-slate-400 mb-8 hover:text-slate-900 transition-colors">← Catálogo</button>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-16 items-start">
              <div className="lg:col-span-7 flex flex-col gap-4">
                <div className="aspect-square rounded-[32px] md:rounded-[48px] overflow-hidden bg-white border border-slate-100 shadow-sm">
                   <img src={selectedProduct.images?.[activeImageIndex] || selectedProduct.image} className="w-full h-full object-cover" alt={selectedProduct.name} />
                </div>
                <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
                  {(selectedProduct.images || [selectedProduct.image]).map((img, idx) => (
                    <button key={idx} onClick={() => setActiveImageIndex(idx)} className={`w-16 h-16 md:w-20 md:h-20 rounded-xl overflow-hidden border-2 flex-shrink-0 transition-all ${activeImageIndex === idx ? 'border-amber-600 scale-95' : 'border-transparent opacity-60'}`}><img src={img} className="w-full h-full object-cover" alt="thumb" /></button>
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
                      <h4 className="text-[9px] font-black uppercase tracking-widest text-slate-400">Opções</h4>
                      <div className="flex flex-wrap gap-2">
                         {selectedProduct.variants.map((v, i) => (
                            <button key={i} onClick={() => setSelectedVariant(v)} className={`px-4 py-2 rounded-xl text-[10px] font-bold transition-all border ${selectedVariant?.name === v.name ? 'border-amber-600 bg-amber-50 text-amber-700' : 'border-slate-100 bg-white text-slate-400'}`}>{v.name}</button>
                         ))}
                      </div>
                   </div>
                )}
                <div className="space-y-3">
                   <h4 className="text-[9px] font-black uppercase tracking-widest text-slate-400">Descrição</h4>
                   <p className="text-slate-600 font-body-serif italic text-sm md:text-base leading-relaxed">{selectedProduct.description}</p>
                </div>
                <button onClick={() => addToCart(selectedProduct)} disabled={selectedProduct.stock <= 0} className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:bg-amber-600 disabled:bg-slate-300 transition-all">Adicionar à Cesta 🙏</button>
              </div>
            </div>
          </section>
        )}

        {currentPage === Page.AdminDashboard && isAdmin && (
           <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
              <aside className="w-full lg:w-72 bg-slate-900 text-white p-6 lg:p-10 flex flex-col space-y-6 lg:space-y-12 shrink-0">
                 <div className="flex items-center justify-between lg:justify-start lg:space-x-2">
                    <div className="flex items-center space-x-2 text-amber-500"><IconCross /><span className="font-bold tracking-tighter text-base md:text-lg text-white uppercase">Admin MSF</span></div>
                    <button onClick={() => { setIsAdmin(false); navigateToPage(Page.Home); }} className="lg:hidden text-[9px] font-black uppercase border border-white/20 px-3 py-1 rounded-lg">Sair</button>
                 </div>
                 <nav className="flex flex-row lg:flex-col gap-2 overflow-x-auto no-scrollbar lg:space-y-4 lg:overflow-visible">
                    {[
                      { id: 'products', label: 'Produtos' },
                      { id: 'stock', label: 'Estoque' },
                      { id: 'customizer', label: 'Config Terço' },
                      { id: 'blog', label: 'Blog' }
                    ].map(tab => (
                      <button key={tab.id} onClick={() => setAdminTab(tab.id as any)} className={`whitespace-nowrap flex-grow lg:w-full text-left px-4 py-3 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all ${adminTab === tab.id ? 'bg-amber-600 text-white shadow-lg' : 'text-slate-400 bg-white/5 lg:bg-transparent'}`}>{tab.label}</button>
                    ))}
                 </nav>
                 <button onClick={() => { setIsAdmin(false); navigateToPage(Page.Home); }} className="hidden lg:block p-4 bg-slate-800 text-slate-400 text-[10px] font-black uppercase rounded-2xl hover:bg-red-500 hover:text-white transition-all">Sair do Painel</button>
              </aside>

              <section className="flex-grow p-4 md:p-12 overflow-y-auto">
                 <div className="bg-white p-6 md:p-12 rounded-[24px] md:rounded-[40px] shadow-sm border border-slate-100 max-w-5xl mx-auto">
                    {adminTab === 'products' && (
                      <div className="space-y-8">
                        <div className="flex justify-between items-center">
                          <h3 className="text-xl md:text-2xl font-serif">{editingProduct ? 'Editar' : 'Cadastrar'} Produto</h3>
                          {editingProduct && (
                            <button onClick={() => {
                              setEditingProduct(null);
                              setNewProduct({ name: '', category: CATEGORIES[1], price: 0, stock: 10, description: '', images: [], variants: [], isFeatured: false });
                            }} className="text-[10px] font-black uppercase text-red-500">Cancelar Edição</button>
                          )}
                        </div>

                        <form onSubmit={handleSaveProduct} className="space-y-8">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                              <label className="text-[10px] font-black uppercase text-slate-400">Nome do Artigo</label>
                              <input type="text" placeholder="Ex: Terço de Cristal" value={newProduct.name || ''} className="w-full p-4 bg-slate-50 border rounded-2xl outline-none" onChange={e => setNewProduct(p => ({ ...p, name: e.target.value }))} required />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-black uppercase text-slate-400">Categoria</label>
                              <select value={newProduct.category} className="w-full p-4 bg-slate-50 border rounded-2xl outline-none" onChange={e => setNewProduct(p => ({ ...p, category: e.target.value }))}>{CATEGORIES.slice(1).map(c => <option key={c} value={c}>{c}</option>)}</select>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                            <div className="space-y-2">
                              <label className="text-[10px] font-black uppercase text-slate-400">Preço Base (R$)</label>
                              <input type="number" step="0.01" value={newProduct.price || 0} className="w-full p-4 bg-slate-50 border rounded-2xl outline-none" onChange={e => setNewProduct(p => ({ ...p, price: Number(e.target.value) }))} required />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-black uppercase text-slate-400">Estoque Inicial</label>
                              <input type="number" value={newProduct.stock || 0} className="w-full p-4 bg-slate-50 border rounded-2xl outline-none" onChange={e => setNewProduct(p => ({ ...p, stock: Number(e.target.value) }))} required />
                            </div>
                            <div className="flex items-center space-x-3 pt-6">
                              <input type="checkbox" id="featured" checked={newProduct.isFeatured} onChange={e => setNewProduct(p => ({ ...p, isFeatured: e.target.checked }))} className="w-6 h-6 accent-amber-600 rounded" />
                              <label htmlFor="featured" className="text-[10px] font-black uppercase text-slate-600 cursor-pointer">Destacar na Home</label>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-slate-400">Descrição Detalhada</label>
                            <textarea rows={4} placeholder="Conte a história do produto..." value={newProduct.description || ''} className="w-full p-4 bg-slate-50 border rounded-2xl outline-none" onChange={e => setNewProduct(p => ({ ...p, description: e.target.value }))} required />
                          </div>

                          <div className="space-y-4 p-6 bg-slate-50 rounded-[32px] border border-slate-100">
                             <label className="text-[10px] font-black uppercase text-slate-400">Galeria de Imagens</label>
                             <div className="flex gap-2">
                                <input type="text" placeholder="URL da Imagem" value={tempImageUrl} className="flex-grow p-4 bg-white border rounded-2xl outline-none" onChange={e => setTempImageUrl(e.target.value)} />
                                <button type="button" onClick={addImageUrlToProduct} className="p-4 bg-amber-600 text-white rounded-2xl"><IconPlus /></button>
                             </div>
                             <div className="flex flex-wrap gap-4">
                                {newProduct.images?.map((img, idx) => (
                                   <div key={idx} className="relative w-20 h-20 group">
                                      <img src={img} className="w-full h-full object-cover rounded-xl border" alt="preview" />
                                      <button type="button" onClick={() => removeImageFromProduct(idx)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"><IconX /></button>
                                   </div>
                                ))}
                             </div>
                          </div>

                          <div className="space-y-4 p-6 bg-slate-50 rounded-[32px] border border-slate-100">
                             <label className="text-[10px] font-black uppercase text-slate-400">Variantes (Opcional)</label>
                             <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                <input type="text" placeholder="Ex: Azul Celeste" value={tempVariantName} className="sm:col-span-1 p-4 bg-white border rounded-2xl outline-none" onChange={e => setTempVariantName(e.target.value)} />
                                <input type="number" step="0.01" placeholder="Delta Preço (R$)" value={tempVariantPrice} className="sm:col-span-1 p-4 bg-white border rounded-2xl outline-none" onChange={e => setTempVariantPrice(Number(e.target.value))} />
                                <button type="button" onClick={addVariantToProduct} className="sm:col-span-1 p-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px]">Add Variante</button>
                             </div>
                             <div className="space-y-2">
                                {newProduct.variants?.map((v, idx) => (
                                   <div key={idx} className="flex justify-between items-center bg-white p-3 rounded-xl border text-sm">
                                      <span>{v.name} ({v.priceDelta >= 0 ? '+' : ''} R$ {v.priceDelta.toFixed(2)})</span>
                                      <button type="button" onClick={() => removeVariantFromProduct(idx)} className="text-red-500 font-bold">Remover</button>
                                   </div>
                                ))}
                             </div>
                          </div>

                          <button type="submit" className="w-full py-6 bg-amber-600 text-white rounded-3xl font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:bg-amber-700 transition-all">
                             {editingProduct ? 'Salvar Alterações do Artigo' : 'Concluir Cadastro do Artigo'}
                          </button>
                        </form>
                      </div>
                    )}

                    {adminTab === 'stock' && (
                      <div className="space-y-6">
                        <h3 className="text-xl md:text-2xl font-serif">Gestão de Estoque</h3>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs md:text-sm">
                            <thead className="bg-slate-50 border-b text-[9px] font-black uppercase text-slate-400">
                              <tr>
                                <th className="p-4">Produto</th>
                                <th className="p-4">Categoria</th>
                                <th className="p-4 text-center">Preço</th>
                                <th className="p-4 text-center">Estoque</th>
                                <th className="p-4 text-right">Ações</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y">
                              {products.map(p => (
                                <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                                  <td className="p-4 flex items-center space-x-3">
                                    <img src={p.image} className="w-10 h-10 rounded-lg object-cover" alt="p" />
                                    <p className="font-bold truncate max-w-[150px]">{p.name}</p>
                                  </td>
                                  <td className="p-4 text-slate-400">{p.category}</td>
                                  <td className="p-4 text-center font-bold">R$ {p.price.toFixed(2)}</td>
                                  <td className="p-4 text-center">
                                    <span className={`px-3 py-1 rounded-full font-black ${p.stock <= 2 ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-600'}`}>{p.stock}</span>
                                  </td>
                                  <td className="p-4 text-right space-x-2">
                                    <button onClick={() => updateStock(p.id, 1)} className="bg-slate-100 p-2 rounded-lg hover:bg-slate-200" title="Aumentar Estoque">+</button>
                                    <button onClick={() => updateStock(p.id, -1)} className="bg-slate-100 p-2 rounded-lg hover:bg-slate-200" title="Diminuir Estoque">-</button>
                                    <button onClick={() => startEditingProduct(p)} className="bg-amber-600 text-white p-2 px-3 rounded-lg text-[9px] font-black uppercase hover:bg-amber-700">Ed</button>
                                    <button onClick={() => deleteProduct(p.id)} className="bg-red-50 text-red-500 p-2 px-3 rounded-lg text-[9px] font-black uppercase hover:bg-red-500 hover:text-white">X</button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {adminTab === 'customizer' && (
                       <div className="space-y-12">
                          <div className="flex justify-between items-center">
                            <h3 className="text-xl md:text-2xl font-serif">Configuração do Customizador</h3>
                            {editingCustomOption.type && (
                              <button onClick={() => {
                                setEditingCustomOption({type: '', option: null});
                                setTempCustomOption({name: '', price: 0, image: ''});
                              }} className="text-[10px] font-black uppercase text-red-500 underline">Cancelar Edição de Opção</button>
                            )}
                          </div>

                          <form onSubmit={handleSaveCustomOption} className="bg-slate-50 p-8 rounded-[40px] border border-slate-100 space-y-6">
                            <h4 className="text-[11px] font-black uppercase text-slate-400 tracking-widest">{editingCustomOption.option ? 'Editar' : 'Adicionar Nova'} Opção de Terço</h4>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                               <select className="p-4 bg-white border rounded-2xl outline-none" value={editingCustomOption.type} onChange={e => setEditingCustomOption(prev => ({...prev, type: e.target.value as any}))} required>
                                  <option value="">Selecione o Tipo...</option>
                                  <option value="material">Material das Contas</option>
                                  <option value="color">Cor Principal</option>
                                  <option value="crucifix">Crucifixo / Cruz</option>
                               </select>
                               <input type="text" placeholder="Nome da Opção" value={tempCustomOption.name || ''} className="p-4 bg-white border rounded-2xl outline-none" onChange={e => setTempCustomOption({...tempCustomOption, name: e.target.value})} required />
                               <input type="number" step="0.01" placeholder="Preço Adicional" value={tempCustomOption.price || 0} className="p-4 bg-white border rounded-2xl outline-none" onChange={e => setTempCustomOption({...tempCustomOption, price: Number(e.target.value)})} />
                               <button type="submit" className="bg-amber-600 text-white p-4 rounded-2xl font-black uppercase text-[10px] shadow-lg">Salvar Opção</button>
                            </div>
                            {(editingCustomOption.type === 'material' || editingCustomOption.type === 'crucifix') && (
                              <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-slate-400">URL da Imagem de Prévia</label>
                                <input type="text" placeholder="https://..." value={tempCustomOption.image || ''} className="w-full p-4 bg-white border rounded-2xl outline-none" onChange={e => setTempCustomOption({...tempCustomOption, image: e.target.value})} />
                              </div>
                            )}
                          </form>

                          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                             {/* Coluna Materiais */}
                             <div className="space-y-4">
                                <h5 className="font-black text-[10px] uppercase text-slate-500 tracking-widest border-b pb-2">Contas ({materials.length})</h5>
                                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 no-scrollbar">
                                   {materials.map(m => (
                                      <div key={m.id} className="flex items-center justify-between p-3 bg-white border rounded-xl hover:shadow-md transition-shadow">
                                         <div className="flex items-center gap-3 truncate">
                                            <img src={m.image} className="w-8 h-8 rounded object-cover border" alt="" />
                                            <div>
                                               <p className="font-bold text-xs truncate">{m.name}</p>
                                               <p className="text-[9px] text-amber-600 font-bold">+ R$ {m.price.toFixed(2)}</p>
                                            </div>
                                         </div>
                                         <div className="flex gap-2">
                                            <button onClick={() => startEditingCustomOption('material', m)} className="text-amber-500 text-[9px] font-black uppercase">Ed</button>
                                            <button onClick={() => deleteCustomOption('material', m.id)} className="text-red-500 text-[9px] font-black uppercase">X</button>
                                         </div>
                                      </div>
                                   ))}
                                </div>
                             </div>

                             {/* Coluna Cores */}
                             <div className="space-y-4">
                                <h5 className="font-black text-[10px] uppercase text-slate-500 tracking-widest border-b pb-2">Cores ({colors.length})</h5>
                                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 no-scrollbar">
                                   {colors.map(c => (
                                      <div key={c.id} className="flex items-center justify-between p-3 bg-white border rounded-xl hover:shadow-md transition-shadow">
                                         <div className="truncate">
                                            <p className="font-bold text-xs truncate">{c.name}</p>
                                            <p className="text-[9px] text-amber-600 font-bold">+ R$ {c.price.toFixed(2)}</p>
                                         </div>
                                         <div className="flex gap-2">
                                            <button onClick={() => startEditingCustomOption('color', c)} className="text-amber-500 text-[9px] font-black uppercase">Ed</button>
                                            <button onClick={() => deleteCustomOption('color', c.id)} className="text-red-500 text-[9px] font-black uppercase">X</button>
                                         </div>
                                      </div>
                                   ))}
                                </div>
                             </div>

                             {/* Coluna Crucifixos */}
                             <div className="space-y-4">
                                <h5 className="font-black text-[10px] uppercase text-slate-500 tracking-widest border-b pb-2">Crucifixos ({crucifixes.length})</h5>
                                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 no-scrollbar">
                                   {crucifixes.map(x => (
                                      <div key={x.id} className="flex items-center justify-between p-3 bg-white border rounded-xl hover:shadow-md transition-shadow">
                                         <div className="flex items-center gap-3 truncate">
                                            <img src={x.image} className="w-8 h-8 rounded object-cover border" alt="" />
                                            <div>
                                               <p className="font-bold text-xs truncate">{x.name}</p>
                                               <p className="text-[9px] text-amber-600 font-bold">+ R$ {x.price.toFixed(2)}</p>
                                            </div>
                                         </div>
                                         <div className="flex gap-2">
                                            <button onClick={() => startEditingCustomOption('crucifix', x)} className="text-amber-500 text-[9px] font-black uppercase">Ed</button>
                                            <button onClick={() => deleteCustomOption('crucifix', x.id)} className="text-red-500 text-[9px] font-black uppercase">X</button>
                                         </div>
                                      </div>
                                   ))}
                                </div>
                             </div>
                          </div>
                       </div>
                    )}
                    {adminTab === 'blog' && <p className="text-center py-20 text-slate-400 italic">Módulo de Blog em desenvolvimento.</p>}
                 </div>
              </section>
           </div>
        )}

        {currentPage === Page.AdminLogin && (
           <section className="container mx-auto px-6 py-12 flex items-center justify-center min-h-[60vh]">
              <div className="bg-white p-8 md:p-16 rounded-[40px] md:rounded-[60px] shadow-2xl border border-slate-100 max-w-md w-full text-center">
                 <h2 className="text-2xl md:text-3xl font-serif text-slate-900 mb-8 tracking-tighter">Administração</h2>
                 <form onSubmit={handleAdminLogin} className="space-y-4 md:space-y-6">
                    <input name="user" type="text" className="w-full p-4 md:p-5 bg-slate-50 border border-slate-100 rounded-2xl md:rounded-3xl outline-none" placeholder="Usuário" required />
                    <input name="pass" type="password" className="w-full p-4 md:p-5 bg-slate-50 border border-slate-100 rounded-2xl md:rounded-3xl outline-none" placeholder="Senha" required />
                    {loginError && <p className="text-red-500 text-[10px] font-black uppercase tracking-widest">{loginError}</p>}
                    <button type="submit" className="w-full py-4 md:py-5 bg-slate-900 text-white rounded-2xl md:rounded-3xl font-black text-xs tracking-widest shadow-xl hover:bg-amber-600 transition-all">Autenticar</button>
                 </form>
              </div>
           </section>
        )}
      </main>

      <footer className="bg-[#0a0f1a] text-slate-400 py-12 md:py-20 px-6 border-t border-white/5">
        <div className="container mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-12 md:mb-20 text-center md:text-left">
          <div className="space-y-4 md:space-y-6 flex flex-col items-center md:items-start">
            <div className="flex items-center space-x-3 text-white">
              <span className="text-amber-500 text-3xl md:text-4xl font-light">+</span>
              <h2 className="text-xl md:text-2xl font-serif tracking-tighter leading-tight">MINHA SANTA<br/>FONTE</h2>
            </div>
            <p className="font-body-serif italic text-xs md:text-sm leading-relaxed opacity-60 max-w-xs">Transformando espaços comuns em lugares de oração e contemplação.</p>
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
              <li>contato@minhasantafonte.com.br</li>
              <li>(11) 99999-9999</li>
            </ul>
          </div>
          <div>
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mb-6 md:mb-8">Newsletter</h3>
            <div className="flex bg-white/5 rounded-xl overflow-hidden p-1">
              <input type="email" placeholder="E-mail" className="bg-transparent border-none outline-none px-4 py-2 text-xs flex-grow text-white" />
              <button className="bg-[#e68a00] text-white px-4 py-2 text-[9px] font-black uppercase rounded-lg">Amém</button>
            </div>
          </div>
        </div>
        <div className="container mx-auto pt-10 border-t border-white/5 flex flex-col md:flex-row justify-between items-center text-[9px] font-black uppercase tracking-[0.2em] opacity-40">
          <p>© 2026 MINHA SANTA FONTE</p>
          <div className="flex space-x-6 mt-4 md:mt-0"><span>Privacidade</span><span>Termos</span></div>
        </div>
      </footer>

      <a href="https://wa.me/5511999999999" target="_blank" className="fixed bottom-6 right-6 md:bottom-10 md:right-10 z-50 bg-[#22c55e] w-14 h-14 md:w-20 md:h-20 rounded-full shadow-lg flex items-center justify-center hover:scale-110 transition-all">
        <IconWhatsApp />
      </a>

      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
           <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setIsCartOpen(false)}></div>
           <div className="relative w-full max-w-sm md:max-w-md bg-white h-full p-6 md:p-10 flex flex-col">
              <div className="flex justify-between items-center mb-10">
                 <h3 className="text-xl md:text-2xl font-serif">Sua Cesta</h3>
                 <button onClick={() => setIsCartOpen(false)}><IconX /></button>
              </div>
              <div className="flex-grow overflow-y-auto space-y-4">
                 {cart.length === 0 ? <p className="text-center py-20 text-slate-400 italic">Cesta vazia.</p> : cart.map((item, idx) => (
                   <div key={`${item.id}-${idx}`} className="flex gap-4 border-b border-slate-50 pb-4">
                      <img src={item.image} className="w-12 h-12 md:w-16 md:h-16 rounded-xl object-cover" alt="item" />
                      <div className="flex-grow">
                         <h4 className="font-bold text-xs md:text-sm text-slate-800 truncate max-w-[150px]">{item.name}</h4>
                         <p className="text-amber-600 font-bold text-xs">R$ {item.price.toFixed(2)}</p>
                      </div>
                      <button onClick={() => removeFromCart(item.id, item.selectedVariant?.name)} className="text-[9px] text-red-400 font-black uppercase">Excluir</button>
                   </div>
                 ))}
              </div>
              <div className="pt-6 border-t mt-6">
                 <div className="flex justify-between text-xl font-black mb-6">
                    <span className="text-[9px] uppercase tracking-widest text-slate-400">Total</span>
                    <span>R$ {cartTotal.toFixed(2)}</span>
                 </div>
                 <button className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase shadow-xl">Finalizar Pedido</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default App;
