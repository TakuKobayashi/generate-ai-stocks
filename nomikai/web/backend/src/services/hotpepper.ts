// ホットペッパーグルメAPI + ValueCommerceアフィリエイト連携

export interface Restaurant {
  id: string;
  name: string;
  genre: string;
  budget: string;
  address: string;
  lat: number;
  lng: number;
  photo: string;
  catchCopy: string;
  shopUrl: string;       // 通常URL
  affiliateUrl: string;  // アフィリエイトURL
  access: string;
  open: string;
  capacity: number;
}

interface HotPepperShop {
  id: string;
  name: string;
  genre: { name: string };
  budget: { name: string };
  address: string;
  lat: string;
  lng: string;
  photo: { mobile: { l: string } };
  catch: string;
  urls: { pc: string };
  mobile_access: string;
  open: string;
  capacity: number;
}

interface HotPepperResponse {
  results: {
    shop: HotPepperShop[];
    results_available: number;
  };
}

// ValueCommerceアフィリエイトリンク生成
// ValueCommerce経由でホットペッパーのアフィリエイトリンクを生成
function buildAffiliateUrl(
  shopUrl: string,
  affiliateId: string,
  affiliatePid: string
): string {
  // ValueCommerce アフィリエイトURL形式
  // https://ck.jp.ap.valuecommerce.com/servlet/referral?sid=SID&pid=PID&vc_url=ENCODED_URL
  const encodedUrl = encodeURIComponent(shopUrl);
  return `https://ck.jp.ap.valuecommerce.com/servlet/referral?sid=${affiliateId}&pid=${affiliatePid}&vc_url=${encodedUrl}`;
}

export interface SearchRestaurantsOptions {
  lat: number;
  lng: number;
  range?: 1 | 2 | 3 | 4 | 5; // 1:300m 2:500m 3:1000m 4:2000m 5:3000m
  count?: number;
  keyword?: string;
}

export async function searchRestaurants(
  apiKey: string,
  affiliateId: string,
  affiliatePid: string,
  options: SearchRestaurantsOptions
): Promise<Restaurant[]> {
  const { lat, lng, range = 3, count = 10, keyword } = options;

  const params = new URLSearchParams({
    key: apiKey,
    lat: String(lat),
    lng: String(lng),
    range: String(range),
    count: String(count),
    format: 'json',
    type: 'lite',
  });

  if (keyword) {
    params.set('keyword', keyword);
  }

  const url = `https://webservice.recruit.co.jp/hotpepper/gourmet/v1/?${params}`;

  const res = await fetch(url, {
    headers: { 'User-Agent': 'NomikaiApp/1.0' },
  });

  if (!res.ok) {
    throw new Error(`ホットペッパーAPI エラー: ${res.status}`);
  }

  const data: HotPepperResponse = await res.json();
  const shops = data.results?.shop ?? [];

  return shops.map((shop) => ({
    id: shop.id,
    name: shop.name,
    genre: shop.genre?.name ?? '',
    budget: shop.budget?.name ?? '',
    address: shop.address,
    lat: parseFloat(shop.lat),
    lng: parseFloat(shop.lng),
    photo: shop.photo?.mobile?.l ?? '',
    catchCopy: shop.catch ?? '',
    shopUrl: shop.urls?.pc ?? '',
    affiliateUrl: buildAffiliateUrl(shop.urls?.pc ?? '', affiliateId, affiliatePid),
    access: shop.mobile_access ?? '',
    open: shop.open ?? '',
    capacity: shop.capacity ?? 0,
  }));
}
