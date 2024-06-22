import { PrismaClient, Category } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();

const points = JSON.parse(fs.readFileSync('seed/users.json', 'utf-8'));

const products = [
  { name: 'Баранина', category: Category.MEAT },
  { name: 'Антрекот', category: Category.MEAT },
  { name: 'Говядина', category: Category.MEAT },
  { name: 'Окорочка', category: Category.MEAT },
  { name: 'Шашлык картошка', category: Category.MEAT },
  { name: 'Крылышки', category: Category.MEAT },
  { name: 'Рулет из говядины', category: Category.MEAT },
  { name: 'Люля кебаб', category: Category.MEAT },
  { name: 'Филе куриное', category: Category.MEAT },
  { name: 'Индейка', category: Category.MEAT },
  { name: 'Утка', category: Category.MEAT },
  { name: 'Седло барашка', category: Category.MEAT },
  { name: 'Ребрышки', category: Category.MEAT },
  { name: 'Филе окорчка для донера', category: Category.MEAT },
  { name: 'Овощной', category: Category.VEGETARIAN },
  { name: 'Грибы', category: Category.VEGETARIAN },
  { name: 'Наполеон', category: Category.BAKERY },
  { name: 'Чак Чак', category: Category.BAKERY },
  { name: 'Пахлава', category: Category.BAKERY },
  { name: 'Лаваш', category: Category.BAKERY },
  { name: 'Лепешка', category: Category.BAKERY },
  { name: 'Пироги все', category: Category.BAKERY },
  { name: 'Соус мед горч', category: Category.SAUCES },
  { name: 'Соус белый', category: Category.SAUCES },
  { name: 'Соус красный', category: Category.SAUCES },
  { name: 'Соус фирменный', category: Category.SAUCES },
  { name: 'Соус сырный', category: Category.SAUCES },
  { name: 'Халапеньо', category: Category.SAUCES },
  { name: 'Кетчуп', category: Category.SAUCES },
  { name: 'Ачичук салат', category: Category.SAUCES },
  { name: 'Салат Цезарь', category: Category.SAUCES },
  { name: 'Салат греческий', category: Category.SAUCES },
  { name: 'Салат баклажан', category: Category.SAUCES },
  { name: 'Пепси 1 литр', category: Category.DRINKS },
  { name: 'Пепси 0,5', category: Category.DRINKS },
  { name: 'Миринда 1 литр', category: Category.DRINKS },
  { name: 'Миринда 0,5', category: Category.DRINKS },
  { name: '7 UP 1 литр', category: Category.DRINKS },
  { name: '7 UP 0,5', category: Category.DRINKS },
  { name: 'Липтон 1 литр', category: Category.DRINKS },
  { name: 'Липтон 0,5', category: Category.DRINKS },
  { name: 'Асу 1 литр', category: Category.DRINKS },
  { name: 'Асу 0,5', category: Category.DRINKS },
  { name: 'Айран', category: Category.DRINKS },
  { name: 'Сок 1 литр', category: Category.DRINKS },
  { name: 'Сок 0,2', category: Category.DRINKS },
  { name: 'Лимонад', category: Category.DRINKS },
  { name: 'Лимонад le gracio', category: Category.DRINKS },
  { name: 'Лимонад в графине', category: Category.DRINKS },
  { name: 'Облепиха', category: Category.DRINKS },
  { name: 'Чай черный', category: Category.DRINKS },
  { name: 'Чай зеленый', category: Category.DRINKS },
  { name: 'Кофе 3 в 1', category: Category.DRINKS },
  { name: 'Донер л', category: Category.FAST_FOOD },
  { name: 'Донер хл', category: Category.FAST_FOOD },
  { name: 'Багет л', category: Category.FAST_FOOD },
  { name: 'Багет хл', category: Category.FAST_FOOD },
  { name: 'Комбо л лаваш', category: Category.FAST_FOOD },
  { name: 'Комбо хл лаваш', category: Category.FAST_FOOD },
  { name: 'Комбо л багет', category: Category.FAST_FOOD },
  { name: 'Комбо хл багет', category: Category.FAST_FOOD },
  { name: 'Наггетсы', category: Category.FAST_FOOD },
  { name: 'Картофельные дольки', category: Category.FAST_FOOD },
  { name: 'Фри', category: Category.FAST_FOOD },
  { name: 'Пицца', category: Category.FAST_FOOD },
  { name: 'Детское меню игрушка', category: Category.SPECIAL },
  { name: 'Доставка бесплатно', category: Category.SPECIAL },
  { name: 'Доставка 1500 тг', category: Category.SPECIAL },
  { name: 'Уголь', category: Category.ADDITIONAL },
  { name: 'Шампура', category: Category.ADDITIONAL },
  { name: 'Тары', category: Category.ADDITIONAL },
];

async function main() {
  for (const product of products) {
    await prisma.product.create({
      data: product,
    });
  }

  for (const point of points) {
    await prisma.point.create({
      data: point,
    });
  }
}

main()
  .catch((e) => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
