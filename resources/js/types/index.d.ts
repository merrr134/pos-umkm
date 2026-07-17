export type Role = 'owner' | 'admin' | 'kasir';

export interface User {
    id: number;
    name: string;
    username: string;
    role: Role;
    is_active: boolean;
    photo_url: string | null;
}

export interface StoreProfile {
    name: string;
    logo: string | null;
}

export interface PaymentMethod {
    id: number;
    name: string;
    code: string;
    is_active: boolean;
}

export type RoundingMethod =
    | 'none'
    | 'up_100'
    | 'up_500'
    | 'up_1000'
    | 'down_100'
    | 'down_500'
    | 'down_1000'
    | 'nearest_100'
    | 'nearest_500'
    | 'nearest_1000';

export interface AppSettings {
    store_name: string;
    store_logo: string | null;
    store_address: string | null;
    store_phone: string | null;
    store_email: string | null;
    store_instagram: string | null;
    receipt_footer: string | null;
    tax_enabled: boolean;
    tax_name: string;
    tax_percent: number;
    rounding_method: RoundingMethod;
    whatsapp_enabled: boolean;
}

export interface Category {
    id: number;
    name: string;
    products_count?: number;
}

export type ProductStatus = 'aktif' | 'habis';

export interface Product {
    id: number;
    category_id: number;
    name: string;
    barcode: string | null;
    price: number;
    cost_price: number | null;
    photo: string | null;
    photo_url: string | null;
    description: string | null;
    status: ProductStatus;
    track_stock: boolean;
    stock: number;
    min_stock: number;
    category?: Category;
}

export interface PaginationLink {
    url: string | null;
    label: string;
    active: boolean;
}

export interface Paginated<T> {
    data: T[];
    current_page: number;
    from: number | null;
    to: number | null;
    total: number;
    last_page: number;
    per_page: number;
    links: PaginationLink[];
}

export type PageProps<
    T extends Record<string, unknown> = Record<string, unknown>,
> = T & {
    auth: {
        user: User;
    };
    store: StoreProfile;
    /** Fase 16 — status kirim struk WhatsApp (shared global). */
    whatsapp: {
        enabled: boolean;
    };
    flash: {
        success: string | null;
        new_password: string | null;
    };
    session: {
        lifetime: number;
    };
};
