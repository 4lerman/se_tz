import { Category, Point, Product } from '@prisma/client';

export type SessionRecordT = {
  selectedProduct?: Product;
  stage: string;
  username?: string;
  password?: string;
  selectedCategory?: string;
  point?: Point;
  remainingStockIndex?: number;
  remainingStockProducts?: {
    product: { id: number; name: string; category: Category };
    quantity: number;
  }[];
};
