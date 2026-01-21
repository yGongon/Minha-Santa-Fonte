
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
    category: CATEGORIES[1],
    stock: 10,
    images: [],
    variants: [],
    isFeatured: false
  });
  
  const [editingCustomOption, setEditingCustomOption] = useState<{type: string, option: RosaryOption | null}>({type: '', option: null});
  const [tempCustomOption, setTempCustomOption] = useState<Partial<RosaryOption>>({ name: '', price: 0, image: '' });

  const [tempImageUrl, setTempImageUrl] = useState("");
  const [tempVariantName, setTempVariantName] = useState("");
  const [tempVariantPrice, setTempVariantPrice] = useState<number>(0);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  // --- Inicialização ---
  useEffect(() => {
    // Carregar Produtos
    const savedProducts = localStorage.getItem('minha_santa_fonte_db_products');
    if (savedProducts) {
      setProducts(JSON.parse(savedProducts));
    } else {
      const initialized = INITIAL_PRODUCTS.map(p => ({ ...p, images: p.images || [p.image], createdAt: Date.now() }));
      setProducts(initialized);
      localStorage.setItem('minha_santa_fonte_db_products', JSON.stringify(initialized));
    }

    // Carregar Opções do Customizador
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

    if (editingProduct) {
      const updatedList = products.map(p => p.id === editingProduct.id ? {
        ...p,
        name: newProduct.name || p.name,
        category: newProduct.category || p.category,
        price: Number(newProduct.price) || p.price,
        stock: Number(newProduct.stock) || p.stock,
        description: newProduct.description || p.description,
        image: newProduct.images?.[0] || p.image,
        images: newProduct.images || p.images,
        variants: newProduct.variants || p.variants,
        isFeatured: newProduct.isFeatured
      } : p);
      saveProductsToDB(updatedList);
      setEditingProduct(null);
      alert("Produto atualizado com sucesso!");
    } else {
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
        isFeatured: newProduct.isFeatured || false,
        createdAt: Date.now()
      };
      saveProductsToDB([productToAdd, ...products]);
      alert("Produto cadastrado com sucesso!");
    }
    
    setNewProduct({ category: CATEGORIES[1], stock: 10, images: [], variants: [], isFeatured: false });
    setTempImageUrl("");
    setTempVariantName("");
    setTempVariantPrice(0);
  };

  const startEditingProduct = (p: Product) => {
    setEditingProduct(p);
    setNewProduct({ ...p });
    setAdminTab('products');
    window.scrollTo(0, 0);
  };

  const handleSaveCustomOption = (e: React.FormEvent) => {
    e.preventDefault();
    const type = editingCustomOption.type as 'material' | 'color' | 'crucifix';
    let currentList = type === 'material' ? materials : type === 'color' ? colors : crucifixes;
    
    const newOpt: RosaryOption = {
      id: editingCustomOption.option?.id || `opt-${Date.now()}`,
      name: tempCustomOption.name || 'Nova Opção',
      price: Number(tempCustomOption.price) || 0,
      image: tempCustomOption.image
    };

    let updatedList;
    if (editingCustomOption.option) {
      updatedList = currentList.map(o => o.id === editingCustomOption.option?.id ? newOpt : o);
    } else {
      updatedList = [...currentList, newOpt];
    }

    saveCustomOptions(type, updatedList);
    setEditingCustomOption({ type: '', option: null });
    setTempCustomOption({ name: '', price: 0, image: '' });
  };

  const deleteCustomOption = (type: 'material' | 'color' | 'crucifix', id: string) => {
    if (window.confirm("Remover esta opção do customizador?")) {
      const currentList = type === 'material' ? materials : type === 'color' ? colors : crucifixes;
      const updatedList = currentList.filter(o => o.id !== id);
      saveCustomOptions(type, updatedList);
    }
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
                       {customStep === 1 && materials.map(m => (
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
                       {customStep === 2 && colors.map(c => (
                         <button key={c.id} onClick={() => {setCustomSelections({...customSelections, color: c}); setCustomStep(3);}} className="p-4 border-2 border-slate-50 rounded-2xl hover:border-amber-500 transition-all text-left">
                            <p className="font-bold">{c.name}</p>
                            <p className="text-xs text-amber-600">{c.price > 0 ? `+ R$ ${c.price.toFixed(2)}` : 'Opção Clássica'}</p>
                         </button>
                       ))}
                       {customStep === 3 && crucifixes.map(x => (
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
                          <div className="space-y-4 text-sm">
                             <div className="flex justify-between items-center">
                                <span className="text-slate-500">Base Ateliê</span>
                                <span className="font-bold">R$ 40.00</span>
                             </div>
                             {customSelections.material && (
                                <div className="flex justify-between items-center">
                                   <span className="font-bold text-slate-900">{customSelections.material.name}</span>
                                   <span className="text-amber-600">+{customSelections.material.price.toFixed(2)}</span>
                                </div>
                             )}
                             {customSelections.crucifix && (
                                <div className="flex justify-between items-center">
                                   <span className="font-bold text-slate-900">{customSelections.crucifix.name}</span>
                                   <span className="text-amber-600">+{customSelections.crucifix.price.toFixed(2)}</span>
                                </div>
                             )}
                             <div className="pt-6 border-t flex justify-between items-end">
                                <div>
                                   <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Valor Total</p>
                                   <p className="text-3xl font-black text-slate-900">R$ {calculateCustomPrice().toFixed(2)}</p>
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

        {currentPage === Page.AdminDashboard && isAdmin && (
           <div className="min-h-screen bg-slate-50 flex">
              <aside className="w-72 bg-slate-900 text-white p-10 flex flex-col space-y-12 shrink-0">
                 <div className="flex items-center space-x-2 text-amber-500">
                    <IconCross /> <span className="font-bold tracking-tighter text-lg text-white uppercase">Painel Admin</span>
                 </div>
                 <nav className="flex-grow space-y-4">
                    <button onClick={() => setAdminTab('products')} className={`w-full text-left p-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${adminTab === 'products' ? 'bg-amber-600 shadow-xl text-white' : 'text-slate-400 hover:bg-slate-800'}`}>Produtos</button>
                    <button onClick={() => setAdminTab('stock')} className={`w-full text-left p-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${adminTab === 'stock' ? 'bg-amber-600 shadow-xl text-white' : 'text-slate-400 hover:bg-slate-800'}`}>Controle Estoque</button>
                    <button onClick={() => setAdminTab('customizer')} className={`w-full text-left p-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${adminTab === 'customizer' ? 'bg-amber-600 shadow-xl text-white' : 'text-slate-400 hover:bg-slate-800'}`}>Config. Terço</button>
                    <button onClick={() => setAdminTab('blog')} className={`w-full text-left p-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${adminTab === 'blog' ? 'bg-amber-600 shadow-xl text-white' : 'text-slate-400 hover:bg-slate-800'}`}>Blog</button>
                 </nav>
                 <button onClick={() => { setIsAdmin(false); setCurrentPage(Page.Home); }} className="p-4 bg-slate-800 text-slate-400 text-[10px] font-black uppercase rounded-2xl hover:bg-red-500 hover:text-white transition-all">Sair</button>
              </aside>

              <section className="flex-grow p-12 overflow-y-auto">
                 {adminTab === 'products' ? (
                    <div className="bg-white p-12 rounded-[40px] shadow-sm border border-slate-100 max-w-4xl mx-auto">
                       <div className="flex justify-between items-center mb-10">
                          <h3 className="text-2xl font-serif text-slate-900">{editingProduct ? 'Editar Artigo' : 'Cadastro de Novo Artigo'}</h3>
                          {editingProduct && <button onClick={() => {setEditingProduct(null); setNewProduct({category: CATEGORIES[1], images: []});}} className="text-amber-600 text-[10px] font-black uppercase tracking-widest underline">Cancelar Edição</button>}
                       </div>
                       
                       <form onSubmit={handleSaveProduct} className="space-y-8">
                          <div className="grid grid-cols-2 gap-6">
                             <div className="space-y-1">
                                <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Nome do Artigo</label>
                                <input type="text" value={newProduct.name || ''} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-3xl outline-none" onChange={e => setNewProduct(p => ({ ...p, name: e.target.value }))} required />
                             </div>
                             <div className="space-y-1">
                                <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Categoria</label>
                                <select value={newProduct.category || CATEGORIES[1]} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-3xl outline-none" onChange={e => setNewProduct(p => ({ ...p, category: e.target.value }))}>
                                   {CATEGORIES.slice(1).map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                             </div>
                          </div>
                          <div className="grid grid-cols-2 gap-6">
                             <div className="space-y-1">
                                <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Preço Base (R$)</label>
                                <input type="number" value={newProduct.price || 0} step="0.01" className="w-full p-5 bg-slate-50 border border-slate-100 rounded-3xl outline-none" onChange={e => setNewProduct(p => ({ ...p, price: Number(e.target.value) }))} required />
                             </div>
                             <div className="space-y-1">
                                <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Estoque Inicial</label>
                                <input type="number" value={newProduct.stock || 0} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-3xl outline-none" onChange={e => setNewProduct(p => ({ ...p, stock: Number(e.target.value) }))} required />
                             </div>
                          </div>
                          
                          <div className="flex items-center space-x-3 bg-slate-50 p-6 rounded-3xl border">
                             <input 
                                type="checkbox" 
                                id="isFeatured" 
                                checked={newProduct.isFeatured || false} 
                                onChange={e => setNewProduct(p => ({...p, isFeatured: e.target.checked}))}
                                className="w-5 h-5 accent-amber-600"
                             />
                             <label htmlFor="isFeatured" className="text-[10px] font-black uppercase text-slate-600 tracking-widest cursor-pointer">Produto em Destaque na Home</label>
                          </div>

                          <div className="space-y-4 pt-6 border-t">
                             <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest block">Variantes (Ex: Cores, Tamanhos)</label>
                             <div className="flex gap-4">
                                <input type="text" className="flex-grow p-5 bg-slate-50 border border-slate-100 rounded-3xl outline-none" placeholder="Ex: Cor Prata" value={tempVariantName} onChange={e => setTempVariantName(e.target.value)} />
                                <input type="number" step="0.01" className="w-32 p-5 bg-slate-50 border border-slate-100 rounded-3xl outline-none" placeholder="+ R$ 0.00" value={tempVariantPrice} onChange={e => setTempVariantPrice(Number(e.target.value))} />
                                <button type="button" onClick={addVariantToProduct} className="px-8 bg-slate-100 text-slate-900 rounded-3xl font-black text-[9px] uppercase tracking-widest hover:bg-slate-200 transition-all">Adicionar</button>
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

                          <div className="space-y-4 pt-6 border-t">
                             <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Galeria de Imagens (URLs)</label>
                             <div className="flex gap-4">
                                <input type="url" className="flex-grow p-5 bg-slate-50 border border-slate-100 rounded-3xl outline-none" placeholder="https://exemplo.com/imagem.jpg" value={tempImageUrl} onChange={e => setTempImageUrl(e.target.value)} />
                                <button type="button" onClick={addImageUrlToProduct} className="px-8 bg-slate-100 text-slate-900 rounded-3xl font-black text-[9px] uppercase tracking-widest hover:bg-slate-200 transition-all">Adicionar</button>
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
                             <textarea rows={4} value={newProduct.description || ''} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-3xl outline-none" onChange={e => setNewProduct(p => ({ ...p, description: e.target.value }))} required></textarea>
                          </div>
                          <button type="submit" className="w-full py-6 bg-slate-900 text-white rounded-3xl font-black text-xs uppercase tracking-[0.3em] shadow-xl hover:bg-amber-600 transition-all">
                             {editingProduct ? 'Salvar Alterações' : 'Publicar no Catálogo'}
                          </button>
                       </form>
                    </div>
                 ) : adminTab === 'stock' ? (
                    <div className="bg-white rounded-[40px] shadow-sm border border-slate-100 overflow-hidden mx-auto max-w-5xl">
                       <table className="w-full text-left">
                          <thead className="bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-400">
                             <tr>
                                <th className="px-10 py-8">Item</th>
                                <th className="px-10 py-8 text-center">Estoque</th>
                                <th className="px-10 py-8 text-right">Ações</th>
                             </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                             {products.map(p => (
                                <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                                   <td className="px-10 py-6">
                                      <div className="flex items-center space-x-4">
                                         <img src={p.image} className="w-12 h-12 rounded-xl object-cover" />
                                         <div>
                                            <p className="font-bold text-slate-800">{p.name}</p>
                                            <p className="text-[9px] uppercase tracking-widest text-amber-600 font-black">{p.category}</p>
                                         </div>
                                      </div>
                                   </td>
                                   <td className="px-10 py-6 text-center">
                                      <span className={`font-black text-xl ${p.stock < 5 ? 'text-amber-600' : 'text-slate-900'}`}>{p.stock}</span>
                                   </td>
                                   <td className="px-10 py-6 text-right">
                                      <div className="flex justify-end space-x-3">
                                         <button onClick={() => updateStock(p.id, -1)} className="w-8 h-8 flex items-center justify-center bg-slate-100 rounded-lg hover:bg-slate-200">-</button>
                                         <button onClick={() => updateStock(p.id, 1)} className="w-8 h-8 flex items-center justify-center bg-slate-100 rounded-lg hover:bg-slate-200">+</button>
                                         <div className="w-px h-8 bg-slate-100 mx-2"></div>
                                         <button onClick={() => startEditingProduct(p)} className="px-4 py-2 bg-slate-900 text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-amber-600 transition-all">Editar</button>
                                         <button onClick={() => deleteProduct(p.id)} className="px-4 py-2 bg-red-50 text-red-500 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all">Excluir</button>
                                      </div>
                                   </td>
                                </tr>
                             ))}
                          </tbody>
                       </table>
                    </div>
                 ) : adminTab === 'customizer' ? (
                    <div className="max-w-5xl mx-auto space-y-12">
                       <h3 className="text-3xl font-serif text-slate-900">Configuração do Monte seu Terço</h3>
                       
                       {/* Seção Gerenciamento de Opções */}
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                          <div className="bg-white p-10 rounded-[40px] shadow-sm border border-slate-100">
                             <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-8">{editingCustomOption.option ? 'Editar Opção' : 'Adicionar Nova Opção'}</h4>
                             <form onSubmit={handleSaveCustomOption} className="space-y-6">
                                <div className="space-y-1">
                                   <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Tipo de Item</label>
                                   <select 
                                      className="w-full p-4 bg-slate-50 border rounded-2xl outline-none"
                                      value={editingCustomOption.type}
                                      onChange={e => setEditingCustomOption(prev => ({...prev, type: e.target.value}))}
                                      required
                                   >
                                      <option value="">Selecione...</option>
                                      <option value="material">Material (Contas)</option>
                                      <option value="color">Cor</option>
                                      <option value="crucifix">Crucifixo</option>
                                   </select>
                                </div>
                                <div className="space-y-1">
                                   <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Nome da Opção</label>
                                   <input 
                                      type="text" 
                                      className="w-full p-4 bg-slate-50 border rounded-2xl outline-none"
                                      value={tempCustomOption.name || ''}
                                      onChange={e => setTempCustomOption(prev => ({...prev, name: e.target.value}))}
                                      required
                                   />
                                </div>
                                <div className="space-y-1">
                                   <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">Preço Adicional (R$)</label>
                                   <input 
                                      type="number" 
                                      step="0.01" 
                                      className="w-full p-4 bg-slate-50 border rounded-2xl outline-none"
                                      value={tempCustomOption.price || 0}
                                      onChange={e => setTempCustomOption(prev => ({...prev, price: Number(e.target.value)}))}
                                      required
                                   />
                                </div>
                                {(editingCustomOption.type === 'material' || editingCustomOption.type === 'crucifix') && (
                                   <div className="space-y-1">
                                      <label className="text-[9px] font-black uppercase tracking-widest text-slate-400">URL da Foto</label>
                                      <input 
                                         type="url" 
                                         className="w-full p-4 bg-slate-50 border rounded-2xl outline-none"
                                         value={tempCustomOption.image || ''}
                                         onChange={e => setTempCustomOption(prev => ({...prev, image: e.target.value}))}
                                         required
                                      />
                                   </div>
                                )}
                                <div className="flex gap-4 pt-4">
                                   <button type="submit" className="flex-grow py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-amber-600 transition-all">Salvar Opção</button>
                                   {editingCustomOption.option && <button type="button" onClick={() => {setEditingCustomOption({type: '', option: null}); setTempCustomOption({name: '', price: 0, image: ''});}} className="px-6 border rounded-2xl text-[9px] font-black uppercase">Cancelar</button>}
                                </div>
                             </form>
                          </div>

                          <div className="space-y-8">
                             {/* Listagem Materiais */}
                             <div className="bg-white rounded-[32px] shadow-sm border border-slate-100 overflow-hidden">
                                <div className="p-6 bg-slate-50 border-b flex justify-between">
                                   <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Materiais (Contas)</span>
                                </div>
                                <div className="divide-y text-sm">
                                   {materials.map(m => (
                                      <div key={m.id} className="p-4 flex items-center justify-between group">
                                         <div className="flex items-center gap-3">
                                            <img src={m.image} className="w-10 h-10 rounded-lg object-cover" />
                                            <span className="font-bold">{m.name}</span>
                                         </div>
                                         <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                            <button onClick={() => {setEditingCustomOption({type: 'material', option: m}); setTempCustomOption(m);}} className="text-blue-500 text-[9px] font-black uppercase">Editar</button>
                                            <button onClick={() => deleteCustomOption('material', m.id)} className="text-red-500 text-[9px] font-black uppercase">Remover</button>
                                         </div>
                                      </div>
                                   ))}
                                </div>
                             </div>

                             {/* Listagem Crucifixos */}
                             <div className="bg-white rounded-[32px] shadow-sm border border-slate-100 overflow-hidden">
                                <div className="p-6 bg-slate-50 border-b flex justify-between">
                                   <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Crucifixos</span>
                                </div>
                                <div className="divide-y text-sm">
                                   {crucifixes.map(x => (
                                      <div key={x.id} className="p-4 flex items-center justify-between group">
                                         <div className="flex items-center gap-3">
                                            <img src={x.image} className="w-10 h-10 rounded-lg object-cover" />
                                            <span className="font-bold">{x.name}</span>
                                         </div>
                                         <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                            <button onClick={() => {setEditingCustomOption({type: 'crucifix', option: x}); setTempCustomOption(x);}} className="text-blue-500 text-[9px] font-black uppercase">Editar</button>
                                            <button onClick={() => deleteCustomOption('crucifix', x.id)} className="text-red-500 text-[9px] font-black uppercase">Remover</button>
                                         </div>
                                      </div>
                                   ))}
                                </div>
                             </div>

                             {/* Listagem Cores */}
                             <div className="bg-white rounded-[32px] shadow-sm border border-slate-100 overflow-hidden">
                                <div className="p-6 bg-slate-50 border-b flex justify-between">
                                   <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Cores</span>
                                </div>
                                <div className="divide-y text-sm">
                                   {colors.map(c => (
                                      <div key={c.id} className="p-4 flex items-center justify-between group">
                                         <span className="font-bold">{c.name}</span>
                                         <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                            <button onClick={() => {setEditingCustomOption({type: 'color', option: c}); setTempCustomOption(c);}} className="text-blue-500 text-[9px] font-black uppercase">Editar</button>
                                            <button onClick={() => deleteCustomOption('color', c.id)} className="text-red-500 text-[9px] font-black uppercase">Remover</button>
                                         </div>
                                      </div>
                                   ))}
                                </div>
                             </div>
                          </div>
                       </div>
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
              <li><button onClick={() => setCurrentPage(Page.Home)} className="hover:text-white transition-colors">Início</button></li>
              <li><button onClick={() => setCurrentPage(Page.Catalog)} className="hover:text-white transition-colors">Catálogo</button></li>
              <li><button onClick={() => setCurrentPage(Page.About)} className="hover:text-white transition-colors">Sobre Nós</button></li>
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
            </ul>
          </div>
          <div>
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mb-8">Newsletter</h3>
            <div className="flex bg-white/5 rounded-xl overflow-hidden p-1">
              <input type="email" placeholder="Seu e-mail de fé" className="bg-transparent border-none outline-none px-4 py-3 text-xs flex-grow text-white" />
              <button className="bg-[#e68a00] text-white px-6 py-3 text-[10px] font-black uppercase tracking-widest rounded-lg">Amém</button>
            </div>
          </div>
        </div>
      </footer>

      <a 
        href="https://wa.me/5511999999999" 
        target="_blank" 
        className="fixed bottom-10 right-10 z-50 bg-[#22c55e] w-20 h-20 rounded-full shadow-[0_0_40px_rgba(34,197,94,0.4)] flex items-center justify-center hover:scale-110 transition-all duration-300 group"
      >
        <IconWhatsApp />
      </a>

      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
           <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setIsCartOpen(false)}></div>
           <div className="relative w-full max-w-md bg-white h-full p-10 flex flex-col">
              <div className="flex justify-between items-center mb-10">
                 <h3 className="text-2xl font-serif">Sua Cesta</h3>
                 <button onClick={() => setIsCartOpen(false)} className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-900">Fechar ✕</button>
              </div>
              <div className="flex-grow overflow-y-auto space-y-6">
                 {cart.length === 0 ? <p className="text-center py-20 text-slate-400 italic">Sua cesta está vazia.</p> : cart.map((item, idx) => (
                   <div key={`${item.id}-${idx}`} className="flex gap-4 border-b border-slate-50 pb-4">
                      <img src={item.image} className="w-16 h-16 rounded-xl object-cover" />
                      <div className="flex-grow">
                         <h4 className="font-bold text-sm text-slate-800">{item.name}</h4>
                         {item.selectedVariant && (
                            <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">{item.selectedVariant.name}</p>
                         )}
                         <p className="text-amber-600 font-bold text-sm">R$ {item.price.toFixed(2)} x {item.quantity}</p>
                      </div>
                      <button onClick={() => removeFromCart(item.id, item.selectedVariant?.name)} className="text-[9px] text-red-400 font-black uppercase tracking-widest hover:text-red-600 self-center">Remover</button>
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
