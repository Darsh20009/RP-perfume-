/**
 * Payment Gateway Integration Service
 * Handles Tamara and Tabby payment processing
 */

interface PaymentSession {
  sessionId: string;
  redirectUrl: string;
  status: "created" | "approved" | "declined" | "pending";
  orderId: string;
  amount: number;
  currency: string;
  createdAt: Date;
}

interface TamaraConfig {
  apiKey: string;
  apiUrl: string;
  isProduction: boolean;
}

interface TabbyConfig {
  apiKey: string;
  apiUrl: string;
  merchantCode: string;
  isProduction: boolean;
}

// In-memory session storage (replace with Redis in production)
const paymentSessions = new Map<string, PaymentSession>();

export class PaymentGateway {
  private tamaraConfig: TamaraConfig;
  private tabbyConfig: TabbyConfig;

  constructor() {
    this.tamaraConfig = {
      apiKey: process.env.TAMARA_API_KEY || "",
      apiUrl: process.env.TAMARA_API_URL || "https://api.tamara.co",
      isProduction: process.env.TAMARA_PRODUCTION === "true",
    };

    this.tabbyConfig = {
      apiKey: process.env.TABBY_API_KEY || "",
      apiUrl: process.env.TABBY_API_URL || "https://api.tabby.ai",
      merchantCode: process.env.TABBY_MERCHANT_CODE || "",
      isProduction: process.env.TABBY_PRODUCTION === "true",
    };
  }

  /**
   * Create Tamara payment session
   */
  async createTamaraSession(orderData: {
    orderId: string;
    amount: number;
    currency?: string;
    items: any[];
    customer: any;
    successUrl: string;
    failureUrl: string;
    cancelUrl: string;
  }): Promise<PaymentSession> {
    const sessionId = `tamara_${orderData.orderId}_${Date.now()}`;
    const currency = orderData.currency || "SAR";

    // Build Tamara API payload
    const payload = {
      order_id: orderData.orderId,
      total_amount: {
        amount: Math.round(orderData.amount * 100) / 100,
        currency,
      },
      items: orderData.items.map((item: any) => ({
        name: item.title,
        quantity: item.quantity,
        unit_price: {
          amount: item.price,
          currency,
        },
        reference_id: item.variantSku || item.productId,
      })),
      customer: {
        first_name: orderData.customer.firstName,
        last_name: orderData.customer.lastName,
        phone_number: orderData.customer.phone,
        email: orderData.customer.email,
      },
      country_code: "SA",
      locale: "ar",
      merchant_url: {
        success: orderData.successUrl,
        failure: orderData.failureUrl,
        cancel: orderData.cancelUrl,
      },
      notification_webhook_url: `${process.env.REPLIT_ORIGIN || "http://localhost:5000"}/api/payments/tamara/webhook`,
    };

    // TODO: Make actual API call to Tamara when API keys are available
    // For now, return mock response
    const session: PaymentSession = {
      sessionId,
      redirectUrl: `https://sandbox.tamara.co/checkout?token=${sessionId}`,
      status: "created",
      orderId: orderData.orderId,
      amount: orderData.amount,
      currency,
      createdAt: new Date(),
    };

    paymentSessions.set(sessionId, session);
    return session;
  }

  /**
   * Create Tabby payment session
   */
  async createTabbySession(orderData: {
    orderId: string;
    amount: number;
    items: any[];
    customer: any;
    shippingAddress: any;
    successUrl: string;
    failureUrl: string;
    cancelUrl: string;
  }): Promise<PaymentSession> {
    const sessionId = `tabby_${orderData.orderId}_${Date.now()}`;

    // Build Tabby API payload
    const payload = {
      merchantCode: this.tabbyConfig.merchantCode,
      merchantReference: orderData.orderId,
      amount: {
        currencyCode: "SAR",
        value: orderData.amount,
      },
      items: orderData.items.map((item: any) => ({
        title: item.title,
        description: item.color ? `${item.color} - ${item.size}` : item.description,
        quantity: item.quantity,
        unitPrice: item.price,
        reference: item.variantSku || item.productId,
      })),
      customer: {
        email: orderData.customer.email,
        phone: orderData.customer.phone,
        firstName: orderData.customer.firstName,
        lastName: orderData.customer.lastName,
      },
      shipmentsInfo: {
        addressLine1: orderData.shippingAddress?.street || "",
        city: orderData.shippingAddress?.city || "",
        countryCode: "SA",
      },
      successUrl: orderData.successUrl,
      failureUrl: orderData.failureUrl,
      cancelUrl: orderData.cancelUrl,
    };

    // TODO: Make actual API call to Tabby when API keys are available
    // For now, return mock response
    const session: PaymentSession = {
      sessionId,
      redirectUrl: `https://checkout.tabby.ai?sessionId=${sessionId}`,
      status: "created",
      orderId: orderData.orderId,
      amount: orderData.amount,
      currency: "SAR",
      createdAt: new Date(),
    };

    paymentSessions.set(sessionId, session);
    return session;
  }

  /**
   * Verify Tamara payment
   */
  async verifyTamaraPayment(orderId: string, paymentId?: string): Promise<boolean> {
    // TODO: Call Tamara API to verify payment status
    // For now, return true for testing
    return true;
  }

  /**
   * Verify Tabby payment
   */
  async verifyTabbyPayment(orderId: string, paymentId?: string): Promise<boolean> {
    // TODO: Call Tabby API to verify payment status
    // For now, return true for testing
    return true;
  }

  /**
   * Handle Tamara webhook
   */
  handleTamaraWebhook(payload: any): { success: boolean; orderId?: string } {
    try {
      const { event_type, order_id, status } = payload;

      console.log(`[Tamara] Webhook received - Event: ${event_type}, Order: ${order_id}, Status: ${status}`);

      // Validate webhook signature (implement in production)
      // const isValid = this.validateTamaraSignature(payload, signature);
      // if (!isValid) return { success: false };

      if (event_type === "payment.approved" || status === "approved") {
        return { success: true, orderId: order_id };
      } else if (event_type === "payment.declined" || status === "declined") {
        console.error(`[Tamara] Payment declined for order: ${order_id}`);
        return { success: false, orderId: order_id };
      }

      return { success: true, orderId: order_id };
    } catch (error) {
      console.error("[Tamara] Webhook error:", error);
      return { success: false };
    }
  }

  /**
   * Handle Tabby webhook
   */
  handleTabbyWebhook(payload: any): { success: boolean; orderId?: string } {
    try {
      const { event, merchantReference, status } = payload;

      console.log(`[Tabby] Webhook received - Event: ${event}, Order: ${merchantReference}, Status: ${status}`);

      // Validate webhook signature (implement in production)
      // const isValid = this.validateTabbySignature(payload, signature);
      // if (!isValid) return { success: false };

      if (status === "APPROVED" || event === "APPROVED") {
        return { success: true, orderId: merchantReference };
      } else if (status === "DECLINED" || event === "DECLINED") {
        console.error(`[Tabby] Payment declined for order: ${merchantReference}`);
        return { success: false, orderId: merchantReference };
      }

      return { success: true, orderId: merchantReference };
    } catch (error) {
      console.error("[Tabby] Webhook error:", error);
      return { success: false };
    }
  }

  /**
   * Get payment session
   */
  getSession(sessionId: string): PaymentSession | undefined {
    return paymentSessions.get(sessionId);
  }

  /**
   * Update session status
   */
  updateSessionStatus(sessionId: string, status: "approved" | "declined" | "pending"): void {
    const session = paymentSessions.get(sessionId);
    if (session) {
      session.status = status;
    }
  }
}

export const paymentGateway = new PaymentGateway();
