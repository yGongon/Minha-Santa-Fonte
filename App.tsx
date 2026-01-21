
import React, { useState, useMemo, useEffect } from 'react';
import { Product, Article, CartItem, Page, CustomRosary, ProductVariant } from './types';
import { 
  PRODUCTS as INITIAL_PRODUCTS, 
  CATEGORIES, 
  ARTICLES as INITIAL_ARTICLES,
  ROSARY_MATERIALS,
  ROSARY_COLORS,
  ROSARY_SIZES,
  ROSARY_CRUCIFIXES,
  ROSARY_MEDALS
} from './constants';

const BASE_ROSARY_PRICE = 40.00;

const App: React.FC = () => {
  // --- Estados de Navegação e Autenticação ---
  const [currentPage, setCurrentPage] = useState<Page>(Page.Home);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [adminTab, setAdminTab] = useState<'products' | 'stock' | 'blog'>('products');

  // --- Estados de Dados ---
  const [products, setProducts] = useState<Product[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("Todos");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);

  // --- Estados do Customizador ---
  const [customStep, setCustomStep] = useState(1);
  const [customSelections, setCustomSelections] = useState<CustomRosary>({});

  // --- Estados de Formulário Admin ---
  const [newProduct, setNewProduct] = useState<Partial<Product>>({
    category: CATEGORIES[1],
    stock: 10,
    images: [],
    variants: []
  });
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
  }, []);

  const saveProductsToDB = (updatedList: Product[]) => {
    setProducts([...updatedList]);
    localStorage.setItem('minha_santa_fonte_db_products', JSON.stringify(updatedList));
  };

  // --- Lógicas de Negócio ---
  const addToCart = (product: Product) => {
    if (product.stock <= 0) {
      alert("Desculpe, este produto está temporariamente esgotado.");
      return;
    }
    
    const finalPrice = product.price + (selectedVariant?.priceDelta || 0);
    
    setCart(prev => {
      const existing = prev.find(item => 
        item.id === product.id && 
        item.selectedVariant?.name === selectedVariant?.name
      );
      
      if (existing) {
        return prev.map(item => 
          (item.id === product.id && item.selectedVariant?.name === selectedVariant?.name) 
          ? { ...item, quantity: item.quantity + 1 } 
          : item
        );
      }
      
      return [...prev, { 
        ...product, 
        price: finalPrice, 
        quantity: 1, 
        selectedVariant: selectedVariant || undefined 
      }];
    });
    setIsCartOpen(true);
  };

  const calculateCustomPrice = () => {
    let total = BASE_ROSARY_PRICE;
    if (customSelections.material) total += customSelections.material.price;
    if (customSelections.color) total += customSelections.color.price;
    if (customSelections.size) total += customSelections.size.price;
    if (customSelections.crucifix) total += customSelections.crucifix.price;
    if (customSelections.medal) total += customSelections.medal.price;
    if (customSelections.personalizationText && customSelections.personalizationText.trim() !== "") total += 15.00;
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
      image: customSelections.material?.image || ROSARY_MATERIALS[0].image || "",
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

  const handleCreateProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProduct.images || newProduct.images.length === 0) {
      alert("Por favor, adicione pelo menos uma imagem.");
      return;
    }
    const productToAdd: Product = {
      id: "prod-" + Date.now(),
      name: newProduct.name || "Sem Nome",
      category: newProduct.category || CATEGORIES[1],
      price: Number(newProduct.price) || 0,
      stock: Number(newProduct.stock) || 0,
      description: newProduct.description || "",
      image: newProduct.images[0],
      images: newProduct.images,
      variants: newProduct.variants || [],
      createdAt: Date.now()
    };
    saveProductsToDB([productToAdd, ...products]);
    setNewProduct({ category: CATEGORIES[1], stock: 10, images: [], variants: [] });
    setTempImageUrl("");
    setTempVariantName("");
    setTempVariantPrice(0);
    alert("Produto cadastrado com sucesso!");
  };

  const addImageUrlToProduct = () => {
    if (tempImageUrl.trim()) {
      setNewProduct(prev => ({
        ...prev,
        images: [...(prev.images || []), tempImageUrl.trim()]
      }));
      setTempImageUrl("");
    }
  };

  const addVariantToProduct = () => {
    if (tempVariantName.trim()) {
      setNewProduct(prev => ({
        ...prev,
        variants: [...(prev.variants || []), { name: tempVariantName.trim(), priceDelta: tempVariantPrice }]
      }));
      setTempVariantName("");
      setTempVariantPrice(0);
    }
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
    window.scrollTo(0, 0);
  };

  // --- Ícones ---
  const IconCross = () => <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M11 2h2v7h7v2h-7v11h-2v-11h-7v-2h7v-7z" /></svg>;
  const IconCart = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" /></svg>;
  const IconWhatsApp = () => <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.72.94 3.675 1.438 5.662 1.439h.005c6.552 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>;
  const IconMail = () => <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>;
  const IconPhone = () => <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>;
  const IconPin = () => <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Header Fixo */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-100">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2 cursor-pointer group" onClick={() => setCurrentPage(Page.Home)}>
            <div className="text-amber-600 transition-transform group-hover:scale-110"><IconCross /></div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-wider text-[18px]">MINHA SANTA FONTE</h1>
              <p className="text-[9px] text-amber-600 font-medium uppercase tracking-[0.2em] leading-none">Fontes | Artigos Religiosos</p>
            </div>
          </div>
          <nav className="hidden md:flex items-center space-x-8 text-[10px] font-black uppercase tracking-widest text-slate-500">
            <button onClick={() => setCurrentPage(Page.Home)} className={currentPage === Page.Home ? 'text-amber-600' : ''}>Início</button>
            <button onClick={() => setCurrentPage(Page.Catalog)} className={currentPage === Page.Catalog ? 'text-amber-600' : ''}>Catálogo</button>
            <button onClick={() => setCurrentPage(Page.Customizer)} className={`flex items-center gap-2 ${currentPage === Page.Customizer ? 'text-amber-600' : ''}`}>Monte seu Terço</button>
            <button onClick={() => setCurrentPage(Page.About)} className={currentPage === Page.About ? 'text-amber-600' : ''}>Sobre Nós</button>
            <button onClick={() => setCurrentPage(Page.AdminLogin)} className="text-amber-700/50 hover:text-amber-700 transition-colors uppercase font-black text-[9px] tracking-[0.2em]">Administração</button>
          </nav>
          <div className="flex items-center space-x-4">
             {isAdmin && <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest">Modo Admin</span>}
             <button className="relative p-2" onClick={() => setIsCartOpen(true)}>
                <IconCart />
                {cartCount > 0 && <span className="absolute -top-1 -right-1 bg-amber-600 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">{cartCount}</span>}
             </button>
          </div>
        </div>
      </header>

      <main className="flex-grow">
        {currentPage === Page.Home && (
          <>
            <section className="relative h-[70vh] flex items-center justify-center overflow-hidden">
              <img src="https://images.unsplash.com/photo-1548623917-2fbc78919640?auto=format&fit=crop&q=80&w=2000" className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-0 bg-slate-900/50"></div>
              <div className="relative text-center text-white px-4 max-w-2xl">
                <h2 className="text-4xl md:text-6xl font-serif mb-6 leading-tight">Espiritualidade e Paz para o seu Lar</h2>
                <p className="text-lg md:text-xl font-light mb-10 italic opacity-90 font-body-serif">Artigos que conectam você ao sagrado, com a tradição e o cuidado que sua fé merece.</p>
                <div className="flex gap-4 justify-center">
                  <button onClick={() => setCurrentPage(Page.Catalog)} className="px-10 py-4 bg-amber-600 text-white font-black text-[10px] uppercase tracking-widest rounded-full hover:bg-amber-700 transition-all shadow-xl">Ver Catálogo</button>
                  <button onClick={() => setCurrentPage(Page.Customizer)} className="px-10 py-4 bg-white/10 backdrop-blur-md border border-white/30 text-white font-black text-[10px] uppercase tracking-widest rounded-full hover:bg-white/20 transition-all">Monte seu Terço</button>
                </div>
              </div>
            </section>
            
            <section className="container mx-auto px-4 py-20 text-center">
               <span className="text-amber-600 font-bold text-xs uppercase tracking-[0.3em] mb-3 block">Destaques</span>
               <h3 className="text-4xl font-serif text-slate-900 mb-12">Artigos Selecionados</h3>
               <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                  {products.filter(p => p.isFeatured).slice(0, 3).map(p => (
                    <div key={p.id} className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm hover:shadow-xl transition-all group cursor-pointer" onClick={() => navigateToProduct(p)}>
                       <div className="aspect-[4/5] rounded-2xl overflow-hidden mb-6">
                          <img src={p.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                       </div>
                       <h4 className="font-bold text-slate-800 mb-2">{p.name}</h4>
                       <p className="text-amber-600 font-black">R$ {p.price.toFixed(2)}</p>
                    </div>
                  ))}
               </div>
            </section>
          </>
        )}

        {currentPage === Page.About && (
          <section className="container mx-auto px-4 py-20 animate-in fade-in duration-700">
            <div className="max-w-4xl mx-auto space-y-20">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                <div>
                  <span className="text-amber-600 font-bold text-[10px] uppercase tracking-[0.4em] mb-6 block">Nossa História</span>
                  <h2 className="text-4xl font-serif text-slate-900 mb-8 leading-tight">Onde a Fé Encontra a Tradição</h2>
                  <div className="space-y-6 text-slate-600 font-body-serif leading-relaxed italic text-lg">
                    <p>
                      A "Minha Santa Fonte" nasceu do desejo profundo de levar o sagrado para dentro dos lares brasileiros de forma autêntica e zelosa. Mais do que uma loja, somos um refúgio para aqueles que buscam fortalecer sua caminhada espiritual.
                    </p>
                    <p>
                      Cada artigo em nosso catálogo é selecionado ou confeccionado com a intenção de ser um instrumento de oração e uma lembrança constante da presença de Deus em nossas vidas.
                    </p>
                  </div>
                </div>
                <div className="relative">
                  <div className="aspect-[4/5] rounded-[60px] overflow-hidden shadow-2xl">
                    <img src="https://images.unsplash.com/photo-1544427928-142f0685600b?auto=format&fit=crop&q=80&w=1000" className="w-full h-full object-cover" />
                  </div>
                  <div className="absolute -bottom-6 -right-6 bg-amber-600 w-32 h-32 rounded-full flex items-center justify-center shadow-xl">
                    <IconCross />
                  </div>
                </div>
              </div>

              <div className="bg-white p-16 rounded-[60px] border border-slate-100 shadow-sm text-center space-y-12">
                <h3 className="text-3xl font-serif text-slate-900">Nossa Missão e Valores</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                  <div className="space-y-4">
                    <div className="w-16 h-16 bg-amber-50 rounded-3xl flex items-center justify-center text-amber-600 mx-auto">
                      <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                    </div>
                    <h4 className="font-bold text-slate-900 uppercase text-xs tracking-widest">Fé e Devoção</h4>
                    <p className="text-slate-500 font-body-serif italic text-sm">Colocamos a espiritualidade no centro de tudo o que fazemos e oferecemos.</p>
                  </div>
                  <div className="space-y-4">
                    <div className="w-16 h-16 bg-amber-50 rounded-3xl flex items-center justify-center text-amber-600 mx-auto">
                      <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>
                    </div>
                    <h4 className="font-bold text-slate-900 uppercase text-xs tracking-widest">Excelência Atemporal</h4>
                    <p className="text-slate-500 font-body-serif italic text-sm">Buscamos materiais de alta qualidade que resistam ao tempo, assim como a tradição.</p>
                  </div>
                  <div className="space-y-4">
                    <div className="w-16 h-16 bg-amber-50 rounded-3xl flex items-center justify-center text-amber-600 mx-auto">
                      <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                    </div>
                    <h4 className="font-bold text-slate-900 uppercase text-xs tracking-widest">Cuidado Humano</h4>
                    <p className="text-slate-500 font-body-serif italic text-sm">Atendemos cada cliente como um irmão em Cristo, com paciência e carinho.</p>
                  </div>
                </div>
              </div>

              <div className="text-center space-y-8 pb-12">
                <p className="text-slate-500 italic font-body-serif text-xl max-w-2xl mx-auto">
                  "Onde quer que dois ou três se reúnam em meu nome, ali eu estou no meio deles."
                </p>
                <div className="w-12 h-px bg-slate-200 mx-auto"></div>
                <button 
                  onClick={() => setCurrentPage(Page.Catalog)} 
                  className="px-12 py-5 bg-slate-900 text-white rounded-full font-black text-[10px] uppercase tracking-[0.3em] hover:bg-amber-600 transition-all shadow-xl"
                >
                  Conhecer Nossos Artigos
                </button>
              </div>
            </div>
          </section>
        )}

        {currentPage === Page.Customizer && (
           <section className="container mx-auto px-4 py-20 max-w-6xl">
              <div className="text-center mb-16">
                 <h2 className="text-4xl font-serif mb-4">Monte seu Terço</h2>
                 <p className="text-slate-400 font-body-serif italic">Personalize cada detalhe do seu instrumento de oração.</p>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                 <div className="lg:col-span-7 bg-white p-10 rounded-[40px] shadow-sm border border-slate-100 min-h-[500px]">
                    <div className="flex justify-between items-center mb-8">
                      <h3 className="text-xl font-bold">Passo {customStep}: {customStep === 1 ? 'Material das Contas' : customStep === 2 ? 'Cor das Contas' : 'O Crucifixo'}</h3>
                      {customStep > 1 && <button onClick={() => setCustomStep(s => s-1)} className="text-[10px] font-black uppercase text-slate-400">Voltar</button>}
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                       {customStep === 1 && ROSARY_MATERIALS.map(m => (
                         <button key={m.id} onClick={() => {setCustomSelections({...customSelections, material: m}); setCustomStep(2);}} className="p-4 border-2 border-slate-50 rounded-2xl hover:border-amber-500 transition-all text-left flex items-center gap-4">
                            <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
                               <img src={m.image} className="w-full h-full object-cover" />
                            </div>
                            <div>
                               <p className="font-bold text-sm">{m.name}</p>
                               <p className="text-[10px] text-amber-600 font-black tracking-widest">+{m.price > 0 ? `R$ ${m.price.toFixed(2)}` : 'Incluso'}</p>
                            </div>
                         </button>
                       ))}
                       {customStep === 2 && ROSARY_COLORS.map(c => (
                         <button key={c.id} onClick={() => {setCustomSelections({...customSelections, color: c}); setCustomStep(3);}} className="p-4 border-2 border-slate-50 rounded-2xl hover:border-amber-500 transition-all text-left">
                            <p className="font-bold">{c.name}</p>
                            <p className="text-xs text-amber-600">{c.price > 0 ? `+ R$ ${c.price.toFixed(2)}` : 'Opção Clássica'}</p>
                         </button>
                       ))}
                       {customStep === 3 && ROSARY_CRUCIFIXES.map(x => (
                         <button key={x.id} onClick={() => {setCustomSelections({...customSelections, crucifix: x}); setCustomStep(4);}} className="p-4 border-2 border-slate-50 rounded-2xl hover:border-amber-500 transition-all text-left flex items-center gap-4">
                            <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
                               <img src={x.image} className="w-full h-full object-cover" />
                            </div>
                            <div>
                               <p className="font-bold text-sm">{x.name}</p>
                               <p className="text-[10px] text-amber-600 font-black tracking-widest">+{x.price > 0 ? `R$ ${x.price.toFixed(2)}` : 'Incluso'}</p>
                            </div>
                         </button>
                       ))}
                       {customStep >= 4 && (
                         <div className="col-span-full text-center py-10">
                            <div className="mb-6 bg-slate-50 rounded-3xl p-8 border border-dashed">
                              <p className="italic font-body-serif text-slate-500">"Cada conta deste terço será unida por oração e dedicação manual em nosso ateliê."</p>
                            </div>
                            <button onClick={addCustomToCart} className="px-16 py-5 bg-slate-900 text-white rounded-3xl font-black text-[10px] tracking-widest uppercase shadow-xl hover:bg-amber-600 transition-all">Adicionar à Cesta 🙏</button>
                         </div>
                       )}
                    </div>
                 </div>

                 {/* Painel de Pré-visualização Dinâmica */}
                 <div className="lg:col-span-5 flex flex-col gap-6">
                    <div className="bg-white rounded-[40px] shadow-sm border border-slate-100 overflow-hidden">
                       <div className="aspect-[4/5] bg-slate-50 relative flex items-center justify-center p-8">
                          {/* Camada: Contas (Fundo) */}
                          <div className={`absolute inset-0 transition-all duration-700 flex items-center justify-center ${customSelections.material ? 'opacity-100 scale-100' : 'opacity-20 scale-90'}`}>
                             {customSelections.material ? (
                               <img src={customSelections.material.image} className="w-full h-full object-cover mix-blend-multiply opacity-80" />
                             ) : (
                               <div className="text-slate-300 opacity-30"><IconCross /></div>
                             )}
                             <div className="absolute inset-0 bg-slate-900/10"></div>
                          </div>

                          {/* Camada: Crucifixo (Frente) */}
                          {customSelections.crucifix && (
                            <div className="relative z-10 animate-in zoom-in fade-in duration-500">
                               <div className="w-44 h-44 rounded-[32px] overflow-hidden border-4 border-white shadow-2xl">
                                  <img src={customSelections.crucifix.image} className="w-full h-full object-cover" />
                               </div>
                               <div className="absolute -bottom-2 -right-2 bg-amber-600 text-white p-2 rounded-full shadow-lg">
                                 <IconCross />
                               </div>
                            </div>
                          )}

                          {/* Overlay de Status */}
                          {!customSelections.material && !customSelections.crucifix && (
                             <div className="relative z-20 text-center">
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Inicie sua criação</p>
                             </div>
                          )}
                       </div>

                       <div className="p-8 bg-white border-t border-slate-50">
                          <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-6">Confecção Atual</h4>
                          <div className="space-y-4">
                             <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500">Base Ateliê</span>
                                <span className="font-bold">R$ 40.00</span>
                             </div>
                             {customSelections.material && (
                                <div className="flex justify-between items-center text-sm">
                                   <span className="font-bold text-slate-900">{customSelections.material.name}</span>
                                   <span className="text-amber-600">+{customSelections.material.price.toFixed(2)}</span>
                                </div>
                             )}
                             {customSelections.color && (
                                <div className="flex justify-between items-center text-sm">
                                   <span className="text-slate-500 italic">Cor: {customSelections.color.name}</span>
                                   <span className="text-amber-600">+{customSelections.color.price.toFixed(2)}</span>
                                </div>
                             )}
                             {customSelections.crucifix && (
                                <div className="flex justify-between items-center text-sm">
                                   <span className="font-bold text-slate-900">{customSelections.crucifix.name}</span>
                                   <span className="text-amber-600">+{customSelections.crucifix.price.toFixed(2)}</span>
                                </div>
                             )}
                             <div className="pt-6 border-t flex justify-between items-end">
                                <div>
                                   <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Valor Total</p>
                                   <p className="text-3xl font-black text-slate-900">R$ {calculateCustomPrice().toFixed(2)}</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-[10px] font-bold text-green-600 uppercase tracking-widest">Pronto para Envio</p>
                                </div>
                             </div>
                          </div>
                       </div>
                    </div>
                 </div>
              </div>
           </section>
        )}

        {currentPage === Page.Catalog && (
          <section className="container mx-auto px-4 py-20">
             <div className="flex justify-between items-end mb-12">
                <h2 className="text-3xl font-serif">Catálogo de Fé</h2>
                <div className="flex gap-2">
                   {CATEGORIES.map(c => <button key={c} onClick={() => setSelectedCategory(c)} className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${selectedCategory === c ? 'bg-slate-900 text-white shadow-lg' : 'bg-white border text-slate-400'}`}>{c}</button>)}
                </div>
             </div>
             <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                {filteredProducts.map(p => (
                  <div key={p.id} className="group cursor-pointer" onClick={() => navigateToProduct(p)}>
                     <div className="aspect-square bg-white rounded-3xl overflow-hidden mb-4 border relative">
                        <img src={p.image} className="w-full h-full object-cover group-hover:scale-105 transition-all duration-500" />
                        {p.stock === 0 && <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center text-white text-[10px] font-black uppercase">Esgotado</div>}
                     </div>
                     <h4 className="font-bold text-sm text-slate-800">{p.name}</h4>
                     <p className="text-amber-600 font-bold">R$ {p.price.toFixed(2)}</p>
                  </div>
                ))}
             </div>
          </section>
        )}

        {currentPage === Page.Product && selectedProduct && (
           <section className="container mx-auto px-4 py-16">
              <button onClick={() => setCurrentPage(Page.Catalog)} className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-12 hover:text-slate-900 transition-colors">← Voltar ao Catálogo</button>
              
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-start">
                 {/* Galeria de Imagens */}
                 <div className="lg:col-span-7 flex flex-col md:flex-row-reverse gap-6">
                    <div className="flex-grow aspect-square rounded-[48px] overflow-hidden bg-white border border-slate-100 shadow-sm">
                       <img 
                          src={selectedProduct.images?.[activeImageIndex] || selectedProduct.image} 
                          className="w-full h-full object-cover animate-in fade-in duration-500" 
                          alt={selectedProduct.name}
                       />
                    </div>
                    {/* Miniaturas */}
                    <div className="flex md:flex-col gap-4 overflow-x-auto md:overflow-y-auto">
                       {(selectedProduct.images || [selectedProduct.image]).map((img, idx) => (
                          <button 
                             key={idx} 
                             onClick={() => setActiveImageIndex(idx)}
                             className={`w-20 h-20 rounded-2xl overflow-hidden border-2 transition-all flex-shrink-0 ${activeImageIndex === idx ? 'border-amber-600 shadow-md' : 'border-white opacity-60 hover:opacity-100'}`}
                          >
                             <img src={img} className="w-full h-full object-cover" />
                          </button>
                       ))}
                    </div>
                 </div>

                 {/* Informações do Produto */}
                 <div className="lg:col-span-5 space-y-10">
                    <div>
                       <span className="text-amber-600 font-black text-[10px] uppercase tracking-[0.3em] mb-4 block">{selectedProduct.category}</span>
                       <h2 className="text-4xl md:text-5xl font-serif text-slate-900 leading-tight mb-4">{selectedProduct.name}</h2>
                       <div className="flex items-center space-x-4">
                          <h3 className="text-3xl font-black text-slate-900">
                             R$ {(selectedProduct.price + (selectedVariant?.priceDelta || 0)).toFixed(2)}
                          </h3>
                          {selectedProduct.stock > 0 ? (
                             <span className="bg-green-50 text-green-600 text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full border border-green-100">Disponível</span>
                          ) : (
                             <span className="bg-red-50 text-red-600 text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full border border-red-100">Esgotado</span>
                          )}
                       </div>
                    </div>

                    {/* Seletor de Variantes */}
                    {selectedProduct.variants && selectedProduct.variants.length > 0 && (
                       <div className="space-y-4">
                          <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Opções Disponíveis</h4>
                          <div className="flex flex-wrap gap-3">
                             {selectedProduct.variants.map((v, i) => (
                                <button 
                                   key={i} 
                                   onClick={() => setSelectedVariant(v)}
                                   className={`px-6 py-3 rounded-2xl text-xs font-bold transition-all border-2 ${selectedVariant?.name === v.name ? 'border-amber-600 bg-amber-50 text-amber-700' : 'border-slate-100 bg-white text-slate-400 hover:border-slate-200'}`}
                                >
                                   {v.name} {v.priceDelta !== 0 && `(${v.priceDelta > 0 ? '+' : ''} R$ ${v.priceDelta.toFixed(2)})`}
                                </button>
                             ))}
                          </div>
                       </div>
                    )}

                    <div className="space-y-4">
                       <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Descrição do Artigo</h4>
                       <p className="text-slate-600 font-body-serif leading-relaxed italic text-lg">{selectedProduct.description}</p>
                    </div>

                    <div className="pt-8 border-t border-slate-100">
                       <button 
                          onClick={() => addToCart(selectedProduct)}
                          disabled={selectedProduct.stock <= 0}
                          className="w-full py-6 bg-slate-900 text-white rounded-3xl font-black text-xs uppercase tracking-[0.3em] shadow-2xl hover:bg-amber-600 disabled:bg-slate-300 disabled:cursor-not-allowed transition-all transform hover:-translate-y-1"
                       >
                          ADICIONAR À CESTA 🙏
                       </button>
                       <p className="text-center mt-6 text-[10px] font-medium text-slate-400 uppercase tracking-widest">Entrega em todo o Brasil com carinho e proteção</p>
                    </div>
                 </div>
              </div>
           </section>
        )}

        {currentPage === Page.AdminDashboard && isAdmin && (
           <div className="min-h-screen bg-slate-50 flex">
              <aside className="w-72 bg-slate-900 text-white p-10 flex flex-col space-y-12">
                 <div className="flex items-center space-x-2 text-amber-500">
                    <IconCross /> <span className="font-bold tracking-tighter text-lg text-white uppercase">Painel Admin</span>
                 </div>
                 <nav className="flex-grow space-y-4">
                    <button onClick={() => setAdminTab('products')} className={`w-full text-left p-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${adminTab === 'products' ? 'bg-amber-600 shadow-xl text-white' : 'text-slate-400 hover:bg-slate-800'}`}>Cadastro</button>
                    <button onClick={() => setAdminTab('stock')} className={`w-full text-left p-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${adminTab === 'stock' ? 'bg-amber-600 shadow-xl text-white' : 'text-slate-400 hover:bg-slate-800'}`}>Controle Estoque</button>
                    <button onClick={() => setAdminTab('blog')} className={`w-full text-left p-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${adminTab === 'blog' ? 'bg-amber-600 shadow-xl text-white' : 'text-slate-400 hover:bg-slate-800'}`}>Blog</button>
                 </nav>
                 <button onClick={() => { setIsAdmin(false); setCurrentPage(Page.Home); }} className="p-4 bg-slate-800 text-slate-400 text-[10px] font-black uppercase rounded-2xl hover:bg-red-500 hover:text-white transition-all">Sair</button>
              </aside>

              <section className="flex-grow p-12 overflow-y-auto">
                 {adminTab === 'products' ? (
                    <div className="bg-white p-12 rounded-[40px] shadow-sm border border-slate-100 max-w-4xl">
                       <h3 className="text-2xl font-serif text-slate-900 mb-8">Cadastro de Novo Artigo</h3>
                       <form onSubmit={handleCreateProduct} className="space-y-8">
                          <div className="grid grid-cols-2 gap-6">
                             <div className="space-y-1">
                                <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Nome do Artigo</label>
                                <input type="text" className="w-full p-5 bg-slate-50 border border-slate-100 rounded-3xl outline-none" onChange={e => setNewProduct(p => ({ ...p, name: e.target.value }))} required />
                             </div>
                             <div className="space-y-1">
                                <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Categoria</label>
                                <select className="w-full p-5 bg-slate-50 border border-slate-100 rounded-3xl outline-none" onChange={e => setNewProduct(p => ({ ...p, category: e.target.value }))}>
                                   {CATEGORIES.slice(1).map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                             </div>
                          </div>
                          <div className="grid grid-cols-2 gap-6">
                             <div className="space-y-1">
                                <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Preço Base (R$)</label>
                                <input type="number" step="0.01" className="w-full p-5 bg-slate-50 border border-slate-100 rounded-3xl outline-none" onChange={e => setNewProduct(p => ({ ...p, price: Number(e.target.value) }))} required />
                             </div>
                             <div className="space-y-1">
                                <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Estoque Inicial</label>
                                <input type="number" className="w-full p-5 bg-slate-50 border border-slate-100 rounded-3xl outline-none" onChange={e => setNewProduct(p => ({ ...p, stock: Number(e.target.value) }))} required />
                             </div>
                          </div>
                          
                          {/* Variantes */}
                          <div className="space-y-4 pt-6 border-t">
                             <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest block">Variantes (Ex: Cores, Tamanhos)</label>
                             <div className="flex gap-4">
                                <input type="text" className="flex-grow p-5 bg-slate-50 border border-slate-100 rounded-3xl outline-none" placeholder="Ex: Cor Prata" value={tempVariantName} onChange={e => setTempVariantName(e.target.value)} />
                                <input type="number" step="0.01" className="w-32 p-5 bg-slate-50 border border-slate-100 rounded-3xl outline-none" placeholder="+ R$ 0.00" value={tempVariantPrice} onChange={e => setTempVariantPrice(Number(e.target.value))} />
                                <button type="button" onClick={addVariantToProduct} className="px-8 bg-slate-100 text-slate-900 rounded-3xl font-black text-[9px] uppercase tracking-widest hover:bg-slate-200 transition-all">Adicionar Variante</button>
                             </div>
                             <div className="flex flex-wrap gap-2">
                                {newProduct.variants?.map((v, i) => (
                                   <div key={i} className="bg-slate-50 border px-4 py-2 rounded-xl flex items-center space-x-3">
                                      <span className="text-[11px] font-bold">{v.name} ({v.priceDelta >= 0 ? '+' : ''} R$ {v.priceDelta.toFixed(2)})</span>
                                      <button type="button" onClick={() => setNewProduct(prev => ({ ...prev, variants: prev.variants?.filter((_, idx) => idx !== i) }))} className="text-red-400 hover:text-red-600 font-black">✕</button>
                                   </div>
                                ))}
                             </div>
                          </div>

                          {/* Galeria de Imagens */}
                          <div className="space-y-4 pt-6 border-t">
                             <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Galeria de Imagens (Adicione URLs)</label>
                             <div className="flex gap-4">
                                <input type="url" className="flex-grow p-5 bg-slate-50 border border-slate-100 rounded-3xl outline-none" placeholder="https://exemplo.com/imagem.jpg" value={tempImageUrl} onChange={e => setTempImageUrl(e.target.value)} />
                                <button type="button" onClick={addImageUrlToProduct} className="px-8 bg-slate-100 text-slate-900 rounded-3xl font-black text-[9px] uppercase tracking-widest hover:bg-slate-200 transition-all">Adicionar Foto</button>
                             </div>
                             <div className="grid grid-cols-5 gap-4 mt-4">
                                {newProduct.images?.map((url, idx) => (
                                   <div key={idx} className="relative aspect-square rounded-2xl overflow-hidden border border-slate-100 group">
                                      <img src={url} className="w-full h-full object-cover" />
                                      <button 
                                         type="button" 
                                         onClick={() => setNewProduct(prev => ({ ...prev, images: prev.images?.filter((_, i) => i !== idx) }))}
                                         className="absolute inset-0 bg-red-500/80 text-white opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center font-black text-[8px] uppercase"
                                      >Remover</button>
                                   </div>
                                ))}
                             </div>
                          </div>

                          <div className="space-y-1 pt-6 border-t">
                             <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Descrição Detalhada</label>
                             <textarea rows={4} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-3xl outline-none" onChange={e => setNewProduct(p => ({ ...p, description: e.target.value }))} required></textarea>
                          </div>
                          <button type="submit" className="w-full py-6 bg-slate-900 text-white rounded-3xl font-black text-xs uppercase tracking-[0.3em] shadow-xl hover:bg-amber-600 transition-all">Publicar no Catálogo</button>
                       </form>
                    </div>
                 ) : adminTab === 'stock' ? (
                    <div className="bg-white rounded-[40px] shadow-sm border border-slate-100 overflow-hidden">
                       <table className="w-full text-left">
                          <thead className="bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-400">
                             <tr>
                                <th className="px-10 py-8">Item</th>
                                <th className="px-10 py-8 text-center">Estoque</th>
                                <th className="px-10 py-8 text-right">Ação</th>
                             </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                             {products.map(p => (
                                <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                                   <td className="px-10 py-6">
                                      <div className="flex items-center space-x-4">
                                         <img src={p.image} className="w-12 h-12 rounded-xl object-cover" />
                                         <span className="font-bold text-slate-800">{p.name}</span>
                                      </div>
                                   </td>
                                   <td className="px-10 py-6 text-center">
                                      <span className={`font-black text-xl ${p.stock < 5 ? 'text-amber-600' : 'text-slate-900'}`}>{p.stock}</span>
                                   </td>
                                   <td className="px-10 py-6 text-right">
                                      <div className="flex justify-end space-x-2">
                                         <button onClick={() => updateStock(p.id, -1)} className="w-8 h-8 flex items-center justify-center bg-slate-100 rounded-lg hover:bg-slate-200 transition-all">-</button>
                                         <button onClick={() => updateStock(p.id, 1)} className="w-8 h-8 flex items-center justify-center bg-slate-900 text-white rounded-lg hover:bg-amber-600 transition-all">+</button>
                                      </div>
                                   </td>
                                </tr>
                             ))}
                          </tbody>
                       </table>
                    </div>
                 ) : (
                    <div className="text-center py-20 text-slate-400 italic">Área do Blog em manutenção.</div>
                 )}
              </section>
           </div>
        )}

        {currentPage === Page.AdminLogin && (
           <section className="container mx-auto px-4 py-24 flex items-center justify-center min-h-[70vh]">
              <div className="bg-white p-16 rounded-[60px] shadow-2xl border border-slate-100 max-w-md w-full text-center">
                 <h2 className="text-3xl font-serif text-slate-900 mb-10 tracking-tighter">Administração</h2>
                 <form onSubmit={handleAdminLogin} className="space-y-6">
                    <input name="user" type="text" className="w-full p-5 bg-slate-50 border border-slate-100 rounded-3xl outline-none" placeholder="Usuário" required />
                    <input name="pass" type="password" className="w-full p-5 bg-slate-50 border border-slate-100 rounded-3xl outline-none" placeholder="Senha" required />
                    {loginError && <p className="text-red-500 text-[10px] font-black uppercase tracking-widest">{loginError}</p>}
                    <button type="submit" className="w-full py-5 bg-slate-900 text-white rounded-3xl font-black text-xs tracking-widest shadow-xl hover:bg-amber-600 transition-all">Autenticar</button>
                 </form>
              </div>
           </section>
        )}
      </main>

      {/* FOOTER RESTAURADO CONFORME IMAGEM */}
      <footer className="bg-[#0a0f1a] text-slate-400 py-20 px-6 border-t border-white/5">
        <div className="container mx-auto grid grid-cols-1 md:grid-cols-4 gap-12 mb-20">
          <div className="space-y-6">
            <div className="flex items-center space-x-3 text-white">
              <span className="text-amber-500 text-4xl font-light">+</span>
              <h2 className="text-2xl font-serif tracking-tighter leading-tight">MINHA SANTA<br/>FONTE</h2>
            </div>
            <p className="font-body-serif italic text-sm leading-relaxed opacity-60 max-w-xs">
              Transformando espaços comuns em lugares de oração e contemplação. Tradição, qualidade e profunda devoção em cada peça.
            </p>
          </div>
          <div>
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mb-8">Navegação</h3>
            <ul className="space-y-4 text-[11px] font-bold uppercase tracking-widest">
              <li><button onClick={() => setCurrentPage(Page.Home)} className="hover:text-amber-500 transition-colors">Início</button></li>
              <li><button onClick={() => setCurrentPage(Page.Catalog)} className="hover:text-amber-500 transition-colors">Catálogo</button></li>
              <li><button onClick={() => setCurrentPage(Page.About)} className="hover:text-amber-500 transition-colors">Sobre Nós</button></li>
              <li><button onClick={() => setCurrentPage(Page.AdminLogin)} className="text-amber-600 hover:text-amber-500 transition-colors">Administração</button></li>
            </ul>
          </div>
          <div>
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mb-8">Atendimento</h3>
            <ul className="space-y-6 text-[11px] font-medium tracking-wide">
              <li className="flex items-center space-x-4">
                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center"><IconMail /></div>
                <span>contato@minhasantafonte.com.br</span>
              </li>
              <li className="flex items-center space-x-4">
                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center"><IconPhone /></div>
                <span>(11) 99999-9999</span>
              </li>
              <li className="flex items-center space-x-4">
                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center"><IconPin /></div>
                <span>São Paulo, Brasil</span>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mb-8">Inspiracional</h3>
            <p className="font-body-serif italic text-xs mb-8 leading-relaxed opacity-60">
              "Que a paz de Cristo reine em vossos corações e que sua luz ilumine vosso lar todos os dias."
            </p>
            <div className="flex bg-white/5 rounded-xl overflow-hidden p-1">
              <input type="email" placeholder="Seu e-mail de fé" className="bg-transparent border-none outline-none px-4 py-3 text-xs flex-grow text-white placeholder:text-slate-600" />
              <button className="bg-[#e68a00] text-white px-6 py-3 text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-amber-500 transition-colors">Amém</button>
            </div>
          </div>
        </div>
        <div className="container mx-auto pt-10 border-t border-white/5 flex flex-col md:flex-row justify-between items-center text-[10px] font-black uppercase tracking-[0.2em] opacity-40">
          <p>© 2026 MINHA SANTA FONTE</p>
          <div className="flex space-x-8 mt-4 md:mt-0">
            <button className="hover:text-white transition-colors">Política de Privacidade</button>
            <button className="hover:text-white transition-colors">Termos de Uso</button>
          </div>
        </div>
      </footer>

      {/* WHATSAPP FLOATER RESTAURADO CONFORME IMAGEM */}
      <a 
        href="https://wa.me/5511999999999" 
        target="_blank" 
        className="fixed bottom-10 right-10 z-50 bg-[#22c55e] w-20 h-20 rounded-full shadow-[0_0_40px_rgba(34,197,94,0.4)] flex items-center justify-center hover:scale-110 transition-all duration-300 group"
      >
        <IconWhatsApp />
      </a>

      {/* Cart Drawer */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
           <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setIsCartOpen(false)}></div>
           <div className="relative w-full max-w-md bg-white h-full p-10 flex flex-col">
              <div className="flex justify-between items-center mb-10">
                 <h3 className="text-2xl font-serif">Sua Cesta</h3>
                 <button onClick={() => setIsCartOpen(false)} className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-900">Fechar ✕</button>
              </div>
              <div className="flex-grow overflow-y-auto space-y-6">
                 {cart.map((item, idx) => (
                   <div key={`${item.id}-${idx}`} className="flex gap-4 border-b border-slate-50 pb-4">
                      <img src={item.image} className="w-16 h-16 rounded-xl object-cover" />
                      <div className="flex-grow">
                         <h4 className="font-bold text-sm text-slate-800">{item.name}</h4>
                         {item.selectedVariant && (
                            <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">{item.selectedVariant.name}</p>
                         )}
                         <p className="text-amber-600 font-bold">R$ {item.price.toFixed(2)}</p>
                      </div>
                      <button onClick={() => removeFromCart(item.id, item.selectedVariant?.name)} className="text-[9px] text-red-400 font-black uppercase tracking-widest hover:text-red-600">Remover</button>
                   </div>
                 ))}
              </div>
              <div className="pt-10 border-t mt-10">
                 <div className="flex justify-between text-2xl font-black mb-6">
                    <span className="text-[10px] uppercase tracking-[0.4em] text-slate-400">Total</span>
                    <span>R$ {cartTotal.toFixed(2)}</span>
                 </div>
                 <button className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-amber-600 transition-all">Finalizar Pedido 🙏</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default App;
