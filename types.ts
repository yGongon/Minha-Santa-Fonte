
export interface ProductVariant {
  name: string;
  priceDelta: number; // Diferença de preço em relação ao base
}

export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  description: string;
  image: string; // Imagem principal (capa)
  images?: string[]; // Galeria de imagens adicionais
  variants?: ProductVariant[]; // Variantes do produto (cores, tamanhos, etc)
  isFeatured?: boolean;
  colors?: string[];
  isCustomizable?: boolean;
  customizationDetails?: string;
  stock: number; // Campo de estoque adicionado
  createdAt?: number;
}

export interface RosaryOption {
  id: string;
  name: string;
  price: number;
  image?: string;
}

export interface CustomRosary {
  material?: RosaryOption;
  color?: RosaryOption;
  size?: RosaryOption;
  crucifix?: RosaryOption;
  medal?: RosaryOption;
  personalizationText?: string;
}

export interface Article {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  date: string;
  image: string;
}

export interface CartItem extends Product {
  quantity: number;
  isCustom?: boolean;
  selectedVariant?: ProductVariant;
  customDetails?: CustomRosary;
}

export enum Page {
  Home = 'home',
  Catalog = 'catalog',
  About = 'about',
  Blog = 'blog',
  Product = 'product',
  AdminLogin = 'admin-login',
  AdminDashboard = 'admin-dashboard',
  Customizer = 'customizer'
}
