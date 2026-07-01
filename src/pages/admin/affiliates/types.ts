export type AffiliateStatus = "ACTIVE" | "INACTIVE";
export type CommissionStatus = "PENDING" | "APPROVED" | "PAID" | "CANCELLED";

export type AffiliateUser = {
  id: number;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  role?: string | null;
} | null;

export type UserOption = {
  id: number;
  first_name?: string | null;
  last_name?: string | null;
  name?: string | null;
  full_name?: string | null;
  phone?: string | null;
  email?: string | null;
  role?: string | null;
};

export type Affiliate = {
  id: number;
  user_id: number | null;
  affiliate_code: string | null;
  referral_slug: string | null;
  name: string | null;
  phone: string | null;
  commission_rate: number;
  status: AffiliateStatus;
  total_clicks: number;
  total_orders: number;
  total_earnings: number;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
  share_url_by_code?: string | null;
  share_url_by_slug?: string | null;
  user?: AffiliateUser;
};

export type AffiliateCommission = {
  id: number;
  affiliate_id: number;
  order_id?: number | null;
  amount?: number | null;
  base_amount?: number | null;
  commission_rate?: number | null;
  status: CommissionStatus;
  paid_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  total_sales?: number | null;
  total_earnings?: number | null;
  product_id?: number | null;
  period_day?: string | null;
  period_week_start?: string | null;
  period_month?: string | null;
  period_year?: string | null;
  [key: string]: any;
};

export type AffiliateClick = {
  id: number;
  affiliate_id: number;
  affiliate_code?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  referer_url?: string | null;
  landing_url?: string | null;
  created_at?: string | null;
  product_id?: number | null;
  source?: string | null;
  device?: string | null;
  [key: string]: any;
};

export type AffiliateFormData = {
  user_id: string;
  affiliate_code: string;
  referral_slug: string;
  name: string;
  phone: string;
  commission_rate: string;
  status: AffiliateStatus;
  notes: string;
};
