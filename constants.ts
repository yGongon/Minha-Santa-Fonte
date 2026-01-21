
import { Product, Article, RosaryOption } from './types';

export const CATEGORIES = [
  "Todos",
  "Imagens Sacras",
  "Terços",
  "Bíblias",
  "Velas",
  "Quadros Religiosos",
  "Artigos para Oração",
  "Decoração"
];

// Opções para o Customizador de Terços
export const ROSARY_MATERIALS: RosaryOption[] = [
  { id: 'm1', name: 'Madeira Nobre', price: 0, image: 'https://images.unsplash.com/photo-1590054036457-a5a6ed70e3ef?auto=format&fit=crop&q=80&w=300' },
  { id: 'm2', name: 'Cristal Lapidado', price: 25.00, image: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&q=80&w=300' },
  { id: 'm3', name: 'Pérola Sintética', price: 15.00, image: 'https://images.unsplash.com/photo-1533130061792-64b345e4a833?auto=format&fit=crop&q=80&w=300' }
];

export const ROSARY_COLORS: RosaryOption[] = [
  { id: 'c1', name: 'Azul Mariano', price: 0 },
  { id: 'c2', name: 'Branco Pérola', price: 0 },
  { id: 'c3', name: 'Rosa Místico', price: 5.00 },
  { id: 'c4', name: 'Preto Devoto', price: 0 }
];

export const ROSARY_SIZES: RosaryOption[] = [
  { id: 's1', name: 'Padrão (50cm)', price: 0 },
  { id: 's2', name: 'Longo (70cm)', price: 15.00 },
  { id: 's3', name: 'Dezena (Bolso)', price: -20.00 }
];

export const ROSARY_CRUCIFIXES: RosaryOption[] = [
  { id: 'cr1', name: 'Crucifixo Clássico', price: 0, image: 'https://images.unsplash.com/photo-1544427928-142f0685600b?auto=format&fit=crop&q=80&w=300' },
  { id: 'cr2', name: 'Cruz de São Bento', price: 12.00, image: 'https://images.unsplash.com/photo-1515518554238-664448557997?auto=format&fit=crop&q=80&w=300' }
];

export const ROSARY_MEDALS: RosaryOption[] = [
  { id: 'me1', name: 'Nossa Senhora Aparecida', price: 0 },
  { id: 'me2', name: 'Medalha Milagrosa', price: 8.00 },
  { id: 'me3', name: 'Sagrado Coração', price: 5.00 }
];

export const PRODUCTS: Product[] = [
  {
    id: "1",
    name: "Nossa Senhora Aparecida 30cm",
    category: "Imagens Sacras",
    price: 189.90,
    description: "Imagem de Nossa Senhora Aparecida em resina de alta qualidade com acabamento fino e manto detalhado em azul profundo e dourado. Perfeita para oratórios domésticos.",
    image: "https://images.unsplash.com/photo-1544427928-142f0685600b?auto=format&fit=crop&q=80&w=800",
    isFeatured: true,
    stock: 15
  },
  {
    id: "2",
    name: "Terço de Madeira Nobre",
    category: "Terços",
    price: 45.00,
    description: "Terço confeccionado manualmente com contas de madeira de reflorestamento, cordão resistente e crucifixo em metal envelhecido. Um item clássico de devoção.",
    image: "https://images.unsplash.com/photo-1590054036457-a5a6ed70e3ef?auto=format&fit=crop&q=80&w=800",
    isFeatured: true,
    stock: 20
  },
  {
    id: "3",
    name: "Bíblia Sagrada Luxo",
    category: "Bíblias",
    price: 120.00,
    description: "Tradução oficial da CNBB com capa em couro sintético marrom e detalhes em hot stamping dourado. Inclui mapas e fitilho marcador.",
    image: "https://images.unsplash.com/photo-1515518554238-664448557997?auto=format&fit=crop&q=80&w=800",
    isFeatured: true,
    stock: 8
  },
  {
    id: "4",
    name: "Vela Aromática de Lavanda e Mirra",
    category: "Velas",
    price: 38.00,
    description: "Vela artesanal feita com cera vegetal. Aroma suave que auxilia na concentração e cria um ambiente de paz para seus momentos de oração.",
    image: "https://images.unsplash.com/photo-1570823104626-0b195213a93a?auto=format&fit=crop&q=80&w=800",
    isFeatured: false,
    stock: 35
  },
  {
    id: "5",
    name: "Quadro Oração de São Francisco",
    category: "Quadros Religiosos",
    price: 75.00,
    description: "Quadro com moldura em madeira clara e tipografia elegante. Traz a oração da paz para decorar e abençoar seu lar.",
    image: "https://images.unsplash.com/photo-1518640467707-6811f4a6ab73?auto=format&fit=crop&q=80&w=800",
    isFeatured: false,
    stock: 5
  },
  {
    id: "6",
    name: "Porta Bíblia em Ferro Forjado",
    category: "Artigos para Oração",
    price: 98.50,
    description: "Suporte elegante e resistente para manter a Palavra de Deus em destaque. Design artesanal com acabamento em pintura eletrostática.",
    image: "https://images.unsplash.com/photo-1548623917-2fbc78919640?auto=format&fit=crop&q=80&w=800",
    isFeatured: false,
    stock: 2
  }
];

export const ARTICLES: Article[] = [
  {
    id: "a1",
    title: "A Importância do Terço Diário",
    excerpt: "Descubra como a meditação dos mistérios pode transformar sua rotina e trazer paz interior.",
    content: "O Santo Terço é uma das orações mais queridas da tradição cristã...",
    date: "12 Mar 2024",
    image: "https://images.unsplash.com/photo-1590054036457-a5a6ed70e3ef?auto=format&fit=crop&q=80&w=800"
  },
  {
    id: "a2",
    title: "Preparando o Advento em Família",
    excerpt: "Dicas práticas para vivenciar o tempo de espera pelo Natal com espiritualidade e união.",
    content: "O Advento é um tempo de alegria e expectativa...",
    date: "05 Dez 2023",
    image: "https://images.unsplash.com/photo-1543258103-a62bdc069871?auto=format&fit=crop&q=80&w=800"
  }
];
