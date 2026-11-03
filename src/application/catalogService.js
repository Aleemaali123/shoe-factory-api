import crypto from 'node:crypto';

import { AppError } from '../domain/errors.js';

const categories = [
  'All',
  'Sneakers',
  'Sports',
  'Casual',
  'Formal',
  'Sandals',
  'Watches',
  'Perfumes',
  'Caps',
  'Socks',
];
const categorySet = new Set(categories.slice(1));

function discountPercent(product) {
  if (product.oldPrice <= product.price) return 0;
  return Math.round(((product.oldPrice - product.price) / product.oldPrice) * 100);
}

function featuredRank(product) {
  let rank = Math.round(product.rating * 10);
  if (product.badge) rank += 20;
  return rank;
}

function compare(sort) {
  return (a, b) => {
    if (sort === 'priceLow') return a.price - b.price;
    if (sort === 'priceHigh') return b.price - a.price;
    if (sort === 'rating') return b.rating - a.rating;
    if (sort === 'newest') {
      if (a.isNew !== b.isNew) return a.isNew ? -1 : 1;
      return b.rating - a.rating;
    }
    return featuredRank(b) - featuredRank(a);
  };
}

function imagesOf(product) {
  if (Array.isArray(product.images) && product.images.length > 0) {
    return product.images
      .filter((image) => image && String(image.url ?? '').trim())
      .map((image) => ({
        url: String(image.url).trim(),
        position: String(image.position || 'Front').trim() || 'Front',
        color: String(image.color || '').trim(),
      }));
  }
  const urls = Array.isArray(product.imageUrls) ? [...product.imageUrls] : [];
  if (urls.length === 0 && product.imageUrl) urls.push(product.imageUrl);
  return urls
    .map((url) => String(url ?? '').trim())
    .filter(Boolean)
    .map((url, index) => ({ url, position: index === 0 ? 'Front' : 'Detail', color: '' }));
}

function presentShop(product) {
  const images = imagesOf(product);
  return {
    id: product.id,
    name: product.name,
    category: product.category,
    price: product.price,
    oldPrice: product.oldPrice,
    rating: product.rating ?? 0,
    reviewCount: product.reviewCount ?? 0,
    imageUrls: [...new Set(images.map((image) => image.url))],
    images: images.map((image) => ({
      url: image.url,
      position: image.position,
      color: image.color || '',
    })),
    description: product.description ?? '',
    badge: product.badge || null,
    colors: product.colors ?? [],
    sizes: product.sizes ?? [],
    stock: product.stock ?? 0,
    isNew: Boolean(product.isNew),
    reviews: Array.isArray(product.reviews) ? product.reviews : [],
  };
}

function presentAdmin(product) {
  const images = imagesOf(product);
  return {
    id: product.id,
    name: product.name,
    category: product.category,
    price: product.price,
    oldPrice: product.oldPrice,
    rating: product.rating ?? 0,
    reviewCount: product.reviewCount ?? 0,
    imageUrl: images[0]?.url ?? '',
    images,
    description: product.description ?? '',
    badge: product.badge || null,
    colors: product.colors ?? [],
    sizes: product.sizes ?? [],
    stock: product.stock ?? 0,
    isNew: Boolean(product.isNew),
    listed: product.listed !== false,
  };
}

function normalize(input, existing) {
  const name = String(input.name ?? '').trim();
  if (!name) throw new AppError('Enter a product name.');
  const category = String(input.category ?? '').trim();
  if (!categorySet.has(category)) throw new AppError('Choose a category.');
  const price = Number(input.price);
  if (!Number.isFinite(price) || price <= 0) throw new AppError('Enter a valid price.');
  let oldPrice = Number(input.oldPrice);
  if (!Number.isFinite(oldPrice) || oldPrice < price) oldPrice = price;
  const stock = Number(input.stock);
  if (!Number.isInteger(stock) || stock < 0) {
    throw new AppError('Stock has to be a whole number. Use 0 for out of stock.');
  }
  const colors = (Array.isArray(input.colors) ? input.colors : [])
    .map((color) => String(color).trim())
    .filter(Boolean);
  if (colors.length === 0) throw new AppError('Add at least one colour.');
  const sizes = (Array.isArray(input.sizes) ? input.sizes : [])
    .map((size) => Number(size))
    .filter((size) => Number.isInteger(size) && size > 0);
  if (sizes.length === 0) throw new AppError('Add at least one size.');
  const images = imagesOf(input);
  if (images.length === 0) throw new AppError('Add at least one photo, by upload or URL.');
  const rating = Number(input.rating);
  const reviewCount = Number(input.reviewCount);
  return {
    id: existing?.id,
    name,
    category,
    price,
    oldPrice,
    rating: Number.isFinite(rating) ? rating : existing?.rating ?? 0,
    reviewCount: Number.isInteger(reviewCount) ? reviewCount : existing?.reviewCount ?? 0,
    imageUrls: images.map((image) => image.url),
    images,
    description: String(input.description ?? '').trim(),
    badge: String(input.badge ?? '').trim() || null,
    colors,
    sizes,
    stock,
    isNew: Boolean(input.isNew),
    listed: input.listed !== false,
    reviews: Array.isArray(existing?.reviews) ? existing.reviews : [],
  };
}

function nextId(store) {
  const taken = new Set(store.products().map((product) => product.id));
  let id = `sf${Date.now().toString().slice(-6)}`;
  while (taken.has(id)) id = `sf${crypto.randomBytes(3).toString('hex')}`;
  return id;
}

export function createCatalogService(store) {
  function listedProducts() {
    return store.products().filter((product) => product.listed !== false);
  }

  return {
    categories() {
      return categories;
    },
    browse({ query = '', category = 'All', sort = 'featured' } = {}) {
      const needle = String(query).trim().toLowerCase();
      return listedProducts()
        .filter((product) => {
          if (category && category !== 'All' && product.category !== category) return false;
          if (!needle) return true;
          const colors = Array.isArray(product.colors) ? product.colors.join(' ') : '';
          const haystack = `${product.name} ${product.category} ${product.description ?? ''} ${colors}`.toLowerCase();
          return haystack.includes(needle);
        })
        .sort(compare(sort))
        .map(presentShop);
    },
    find(id) {
      const product = store.product(id);
      if (!product || product.listed === false) return null;
      return presentShop(product);
    },
    listAdmin() {
      return store.products().map(presentAdmin);
    },
    create(input) {
      const product = normalize(input);
      product.id = nextId(store);
      store.saveProduct(product);
      return presentAdmin(product);
    },
    update(id, input) {
      const existing = store.product(id);
      if (!existing) throw new AppError('That product could not be found.', 404);
      const product = normalize(input, existing);
      product.id = existing.id;
      store.saveProduct(product);
      return presentAdmin(product);
    },
    adjustStock(id, delta) {
      const existing = store.product(id);
      if (!existing) throw new AppError('That product could not be found.', 404);
      const change = Number(delta);
      if (!Number.isInteger(change)) throw new AppError('Stock change has to be a whole number.');
      const stock = Math.max(0, (existing.stock ?? 0) + change);
      const product = { ...existing, stock, images: imagesOf(existing), imageUrls: imagesOf(existing).map((image) => image.url) };
      store.saveProduct(product);
      return presentAdmin(product);
    },
    remove(id) {
      const existing = store.product(id);
      if (!existing) throw new AppError('That product could not be found.', 404);
      store.deleteProduct(id);
      return { id, name: existing.name };
    },
    discountPercent,
  };
}
