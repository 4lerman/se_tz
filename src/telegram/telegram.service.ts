import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as TelegramBot from 'node-telegram-bot-api';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { Category } from './enums/category.enum';
import { Action, SessionStage } from './enums/action_session.enum';
import { SessionRecordT } from './types/record.type';

@Injectable()
export class TelegramService implements OnModuleInit {
  private logger = new Logger(TelegramService.name);
  private bot: TelegramBot;

  private soldProducts = [];

  constructor(
    private readonly configService: ConfigService,
    private readonly prismaService: PrismaService,
  ) {
    this.bot = new TelegramBot(this.configService.get('TELEGRAM_BOT_KEY'), {
      polling: true,
    });
  }

  onModuleInit() {
    this.botMessage();
  }

  private sessions: Record<number, SessionRecordT> = {};

  private botMessage() {
    this.bot.onText(/\/start/, this.startHandler);
    this.bot.on('message', this.messageHandler);
  }

  startHandler = async (msg: TelegramBot.Message) => {
    this.logger.log(
      'Received message from ' + msg.chat.username + ': ',
      msg.text,
    );

    const chatId = msg.chat.id;
    if (
      this.sessions[chatId] &&
      this.sessions[chatId].stage == SessionStage.LOGGED_IN
    ) {
      return this.bot.sendMessage(chatId, 'You are logged in');
    }

    this.sessions[chatId] = { stage: SessionStage.LOGIN_PROMPT };

    await this.buttonChoices(chatId, Action.LOGIN, '');
  };

  messageHandler = async (msg: TelegramBot.Message) => {
    const chatId = msg.chat.id;

    if (!this.sessions[chatId]) {
      return;
    }

    const session = this.sessions[chatId];

    if (
      session.stage === SessionStage.LOGIN_PROMPT ||
      session.stage === SessionStage.USERNAME ||
      session.stage === SessionStage.PASSWORD
    )
      await this.loginHanlder(chatId, session, msg);

    if (
      session.stage === SessionStage.LOGGED_IN ||
      session.stage === SessionStage.CHOOSING_CATEGORY ||
      session.stage === SessionStage.CHOOSING_PRODUCT ||
      session.stage === SessionStage.ENTERING_QUANTITY ||
      session.stage === SessionStage.RECORD_REMAINING
    ) {
      await this.arrivalProcess(chatId, session, msg);
    }

    if (session.stage === SessionStage.VIEW_ARRIVAL) {
      await this.viewArrivalHandler(chatId);
    }

    if (session.stage === SessionStage.ENTERING_REMAINING_STOCK) {
      await this.recordRemainingHandler(chatId, session, msg);
    }
  };

  loginHanlder = async (
    chatId: number,
    session: SessionRecordT,
    msg: TelegramBot.Message,
  ) => {
    if (session.stage == SessionStage.LOGIN_PROMPT) {
      if (msg.text == Action.LOGIN) {
        session.stage = SessionStage.USERNAME;
        await this.bot.sendMessage(chatId, 'Please enter your username: ');
      } else if (msg.text == Action.CLOSE) {
        delete this.sessions[chatId];
        await this.bot.sendMessage(chatId, 'Session closed.', {
          reply_markup: {
            remove_keyboard: true,
          },
        });
      }
    } else if (session.stage == SessionStage.USERNAME) {
      session.username = msg.text;
      session.stage = SessionStage.PASSWORD;
      await this.bot.sendMessage(chatId, 'Please enter your password: ');
    } else if (session.stage == SessionStage.PASSWORD) {
      session.password = msg.text;

      const point = await this.prismaService.point.findFirst({
        where: {
          username: session.username,
        },
      });

      if (point && (await bcrypt.compare(session.password, point.password))) {
        session.stage = SessionStage.LOGGED_IN;
        this.sessions[chatId] = {
          stage: SessionStage.LOGGED_IN,
          username: point.username,
          point: point,
        };

        await this.buttonChoices(chatId, Action.ARRIVAL, '');
      } else {
        delete this.sessions[chatId];
        await this.bot.sendMessage(
          chatId,
          'Invalid username or password. Please try again with /start',
          {
            reply_markup: {
              remove_keyboard: true,
            },
          },
        );
      }
    }
  };

  viewArrivalHandler = async (chatId: number) => {
    if (
      !this.sessions[chatId] ||
      (!this.sessions[chatId].username && this.sessions[chatId].password)
    ) {
      return this.bot.sendMessage(chatId, 'Please log in first!');
    }

    const arrivals = await this.getArrivalsForToday(chatId);

    if (arrivals.length === 0) {
      await this.bot.sendMessage(chatId, 'No arrivals recorded for today.');
    } else {
      let message = 'Arrivals for today:\n\n';
      arrivals.forEach((arrival) => {
        message += `${arrival.productName}: ${arrival.totalQuantity}\n`;
      });

      this.logger.debug(message);

      this.sessions[chatId].stage = SessionStage.LOGGED_IN;

      await this.bot.sendMessage(chatId, message);
    }
  };

  arrivalHandler = async (chatId: number) => {
    if (
      !this.sessions[chatId] ||
      (!this.sessions[chatId].username && this.sessions[chatId].password)
    ) {
      return this.bot.sendMessage(chatId, 'Please log in first!');
    }

    const session = this.sessions[chatId];

    session.stage = SessionStage.CHOOSING_CATEGORY;

    await this.bot.sendMessage(chatId, 'Please choose a category:', {
      reply_markup: {
        keyboard: [
          ...Object.values(Category).map((category) => [{ text: category }]),
          [{ text: 'Back to Choices' }],
        ],
        resize_keyboard: true,
      },
    });
  };

  arrivalProcess = async (
    chatId: number,
    session: SessionRecordT,
    msg: TelegramBot.Message,
  ) => {
    const text = msg.text?.trim();

    if (!session) {
      return this.bot.sendMessage(chatId, 'Please start with /start');
    }

    if (text === 'Arrival' || text === 'Back to Category') {
      session.stage = SessionStage.CHOOSING_CATEGORY;
      return await this.arrivalHandler(chatId);
    } else if (text === 'Back to Choices') {
      session.stage = SessionStage.CHOOSING_PRODUCT;
      return await this.buttonChoices(chatId, Action.ARRIVAL, '');
    } else if (text === 'View Arrival') {
      return await this.viewArrivalHandler(chatId);
    } else if (msg.text === 'Record Remaining Stock') {
      session.stage = SessionStage.RECORD_REMAINING;
    }

    if (
      session.stage === SessionStage.CHOOSING_CATEGORY &&
      Object.values(Category).includes(text as Category)
    ) {
      session.stage = SessionStage.CHOOSING_PRODUCT;
      session.selectedCategory = text;

      const products = await this.prismaService.product.findMany({
        where: { category: text as Category },
      });

      await this.bot.sendMessage(chatId, 'Please choose a product:', {
        reply_markup: {
          keyboard: [
            ...products.map((product) => [{ text: product.name }]),
            [{ text: 'Back to Category' }],
          ],
          resize_keyboard: true,
        },
      });
    } else if (
      session.stage === SessionStage.CHOOSING_PRODUCT &&
      session.selectedCategory
    ) {
      const product = await this.prismaService.product.findFirst({
        where: { name: text },
      });

      if (product) {
        session.stage = SessionStage.ENTERING_QUANTITY;
        session.selectedProduct = product;
        await this.bot.sendMessage(
          chatId,
          `Please enter the quantity for ${text}:`,
        );
      } else {
        await this.bot.sendMessage(
          chatId,
          'Invalid product. Please choose a product from the list.',
        );
      }
    } else if (session.stage === SessionStage.ENTERING_QUANTITY) {
      if (!isNaN(parseInt(text))) {
        const quantity = parseInt(text);

        // Save arrival to database
        await this.prismaService.arrival.create({
          data: {
            productId: session.selectedProduct.id,
            quantity,
            pointId: session.point.id,
          },
        });

        session.stage = SessionStage.CHOOSING_PRODUCT;

        await this.bot.sendMessage(
          chatId,
          `Arrival recorded: ${session.selectedProduct.name} - ${quantity}`,
        );
      } else {
        this.logger.debug('session ' + session.stage);
        await this.bot.sendMessage(
          chatId,
          'Invalid input. Please follow the instructions.',
        );
      }
    } else if (session.stage === SessionStage.RECORD_REMAINING) {
      if (
        !session.remainingStockProducts ||
        session.remainingStockIndex === undefined
      ) {
        session.remainingStockProducts =
          await this.prismaService.arrival.findMany({
            where: {
              pointId: session.point.id,
            },
            select: {
              product: true,
              quantity: true,
            },
          });
        session.remainingStockIndex = 0;
      }

      const currentArrival =
        session.remainingStockProducts[session.remainingStockIndex];

      session.stage = SessionStage.ENTERING_REMAINING_STOCK;

      if (currentArrival) {
        await this.buttonChoices(
          chatId,
          Action.RECORD_REMAINING,
          `Please enter the remaining stock for ${currentArrival.product.name}:`,
        );
      } else {
        session.stage = SessionStage.LOGGED_IN;
        await this.bot.sendMessage(
          chatId,
          'Remaining stock recording completed or no arrivals',
        );
        delete session.remainingStockProducts;
        delete session.remainingStockIndex;
        await this.buttonChoices(chatId, Action.ARRIVAL, '');
      }
    }
  };

  recordRemainingHandler = async (
    chatId: number,
    session: SessionRecordT,
    msg: TelegramBot.Message,
  ) => {
    const text = msg.text?.trim();

    if (!session.username && !session.password) {
      return this.bot.sendMessage(chatId, 'Please log in first!');
    }

    if (text === 'Record Remaining Stock') {
      return;
    }

    if (text === 'Back to Choices') {
      session.stage = SessionStage.LOGGED_IN;
      return this.buttonChoices(chatId, Action.ARRIVAL, '');
    }

    if (session.stage === SessionStage.ENTERING_REMAINING_STOCK) {
      const quantity = parseInt(text);
      const arrival =
        session.remainingStockProducts[session.remainingStockIndex];

      if (isNaN(quantity) || quantity > arrival.quantity) {
        return await this.bot.sendMessage(
          chatId,
          'Invalid input. Please enter a valid quantity.',
        );
      }

      await this.prismaService.soldProduct.create({
        data: {
          productId: arrival.product.id,
          quantity: quantity,
          pointId: session.point.id,
        },
      });

      this.soldProducts.push({
        name: arrival.product.name,
        quantity: quantity,
      });

      session.remainingStockIndex += 1;

      if (
        session.remainingStockIndex >= session.remainingStockProducts.length
      ) {
        let message = `Remaining stock recording completed. Sold: \n\n`;
        this.soldProducts.forEach((soldProduct) => {
          message += `${soldProduct.name}: ${soldProduct.quantity}\n`;
        });
        session.stage = SessionStage.LOGGED_IN;
        await this.bot.sendMessage(chatId, message);
        delete session.remainingStockProducts;
        delete session.remainingStockIndex;
        await this.buttonChoices(chatId, Action.ARRIVAL, '');
      } else {
        const nextArrival =
          session.remainingStockProducts[session.remainingStockIndex];
        await this.bot.sendMessage(
          chatId,
          `Please enter the remaining stock for ${nextArrival.product.name}:`,
          {
            reply_markup: {
              keyboard: [[{ text: 'Back' }]],
              resize_keyboard: true,
              one_time_keyboard: true,
            },
          },
        );
      }
    }
  };

  async buttonChoices(chatId: number, action: string, content: string) {
    if (action === Action.LOGIN) {
      await this.bot.sendMessage(
        chatId,
        'To login, please click "Login" button',
        {
          reply_markup: {
            keyboard: [[{ text: 'Login' }], [{ text: 'Close' }]],
            resize_keyboard: true,
            one_time_keyboard: true,
          },
        },
      );
    }

    if (action === Action.ARRIVAL) {
      await this.bot.sendMessage(chatId, 'Choose action:', {
        reply_markup: {
          keyboard: [
            [{ text: 'Arrival' }],
            [{ text: 'View Arrival' }],
            [{ text: 'Record Remaining Stock' }],
          ],
          resize_keyboard: true,
        },
      });
    }

    if (action === Action.RECORD_REMAINING) {
      await this.bot.sendMessage(chatId, content, {
        reply_markup: {
          keyboard: [[{ text: 'Back to Choices' }]],
          resize_keyboard: true,
          one_time_keyboard: true,
        },
      });
    }
  }

  private async getArrivalsForToday(chatId: number) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    today.toISOString();

    const arrivals = await this.prismaService.arrival.groupBy({
      by: ['productId'],
      where: {
        pointId: this.sessions[chatId].point.id,
        createdAt: {
          gte: today,
        },
      },
      _sum: {
        quantity: true,
      },
    });

    const mapped = await Promise.all(
      arrivals.map(async (arrival) => {
        const product = await this.prismaService.product.findFirst({
          where: {
            id: arrival.productId,
          },
        });

        return {
          productName: product.name,
          totalQuantity: arrival._sum.quantity,
        };
      }),
    );

    return mapped;
  }
}
