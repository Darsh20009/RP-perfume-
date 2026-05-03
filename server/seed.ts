import { storage } from "./storage";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";
import { CategoryModel, UserModel, BranchModel } from "./models";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buffer = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buffer.toString("hex")}.${salt}`;
}

export async function seed() {
  // Remove old phone numbers if exist
  await UserModel.deleteMany({ phone: "0532441566" });
  await UserModel.deleteMany({ phone: "0552469643" });
  await UserModel.deleteMany({ phone: "0567326086" });
  await UserModel.deleteMany({ phone: "567326086" });
  await UserModel.deleteMany({ phone: "567891011" });
  
  // Create عطور آر اف admin user
  console.log("Seeding عطور آر اف admin user...");
  const password = await hashPassword("123456");
  await storage.createUser({
    phone: "567891011",
    password,
    role: "admin",
    name: "عطور آر اف",
    username: "567891011",
    email: "support@rfperfume.sa",
    walletBalance: "0",
    addresses: [],
    permissions: [
      "orders.view", "orders.edit", "orders.refund",
      "products.view", "products.edit",
      "customers.view", "wallet.adjust",
      "reports.view", "staff.manage",
      "pos.access", "settings.manage"
    ],
    loginType: "both",
    isActive: true,
    mustChangePassword: false,
    loyaltyPoints: 0,
    loyaltyTier: "bronze",
    totalSpent: 0,
    phoneDiscountEligible: false
  });
  console.log("Admin user created with phone 567891011 and password 123456");

  const defaultCategoryData: Record<string, { nameAr: string; image: string }> = {
    men:         { nameAr: "عطور رجالية",   image: "https://images.unsplash.com/photo-1594035910387-fea081e59fd0?w=400&h=500&fit=crop&auto=format" },
    women:       { nameAr: "عطور نسائية",   image: "https://images.unsplash.com/photo-1588405748880-12d1d2a59f75?w=400&h=500&fit=crop&auto=format" },
    unisex:      { nameAr: "عطور مشتركة",   image: "https://images.unsplash.com/photo-1541643600914-78b084683702?w=400&h=500&fit=crop&auto=format" },
    oud:         { nameAr: "عود ودخون",     image: "https://images.unsplash.com/photo-1615634260167-c8cdede054de?w=400&h=500&fit=crop&auto=format" },
    accessories: { nameAr: "إكسسوارات عطرية", image: "https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=400&h=500&fit=crop&auto=format" },
  };

  const categories = await storage.getCategories();
  if (categories.length === 0) {
    await CategoryModel.insertMany([
      { name: "Men",         slug: "men",         nameAr: "عطور رجالية",     image: defaultCategoryData.men.image },
      { name: "Women",       slug: "women",       nameAr: "عطور نسائية",     image: defaultCategoryData.women.image },
      { name: "Unisex",      slug: "unisex",      nameAr: "عطور مشتركة",     image: defaultCategoryData.unisex.image },
      { name: "Oud & Incense", slug: "oud",       nameAr: "عود ودخون",       image: defaultCategoryData.oud.image },
      { name: "Accessories", slug: "accessories", nameAr: "إكسسوارات عطرية", image: defaultCategoryData.accessories.image },
    ]);
    console.log("Categories seeded");
  } else {
    // Migrate existing categories: add nameAr and image if missing
    for (const cat of categories) {
      const def = defaultCategoryData[cat.slug];
      if (def && (!cat.image || !cat.nameAr)) {
        await storage.updateCategory(cat.id, {
          nameAr: cat.nameAr || def.nameAr,
          image: cat.image || def.image,
        });
      }
    }
  }

  // Seed featured products
  const allCats = await storage.getCategories();
  const catBySlug: Record<string, string> = {};
  for (const c of allCats) catBySlug[c.slug] = c.id;

  const products = await storage.getProducts();
  if (products.length === 0) {
    await storage.createProduct({
      name: "عطر العود الملكي",
      description: "عطر عود فاخر بتركيبة شرقية غنية، يجمع بين العود الكمبودي والمسك الأبيض",
      price: "450",
      cost: "180",
      images: [
        "https://images.unsplash.com/photo-1594035910387-fea081e59fd0?auto=format&fit=crop&q=80",
      ],
      isFeatured: true,
      printBarcode: true,
      categoryIds: [catBySlug.men, catBySlug.oud].filter(Boolean),
      variants: [
        { color: "50ml", size: "50ml", sku: "OUD-50", stock: 20, cost: 180 },
        { color: "100ml", size: "100ml", sku: "OUD-100", stock: 15, cost: 250 },
      ]
    });

    await storage.createProduct({
      name: "عطر آر اف المسك",
      description: "عطر مسك أبيض نقي مع لمسات من الورد الطائفي والعنبر",
      price: "350",
      cost: "140",
      images: [
        "https://images.unsplash.com/photo-1588405748880-12d1d2a59f75?auto=format&fit=crop&q=80",
      ],
      isFeatured: true,
      printBarcode: true,
      categoryIds: [catBySlug.women, catBySlug.unisex].filter(Boolean),
      variants: [
        { color: "30ml", size: "30ml", sku: "MUSK-30", stock: 25, cost: 100 },
        { color: "50ml", size: "50ml", sku: "MUSK-50", stock: 18, cost: 140 },
        { color: "100ml", size: "100ml", sku: "MUSK-100", stock: 12, cost: 200 },
      ]
    });

    await storage.createProduct({
      name: "بخور دخون الفخامة",
      description: "بخور فاخر من العود الطبيعي الممزوج بالعنبر والمسك، رائحة تدوم طويلاً",
      price: "280",
      cost: "100",
      images: [
        "https://images.unsplash.com/photo-1615634260167-c8cdede054de?auto=format&fit=crop&q=80",
      ],
      isFeatured: true,
      printBarcode: true,
      categoryIds: [catBySlug.oud].filter(Boolean),
      variants: [
        { color: "عادي", size: "50g", sku: "BAKH-50", stock: 30, cost: 80 },
        { color: "فاخر", size: "100g", sku: "BAKH-100", stock: 20, cost: 100 },
      ]
    });

    await storage.createProduct({
      name: "عطر ليلة سعودية",
      description: "عطر شرقي فريد يجمع بين الصندل والورد والعود، مثالي للمناسبات",
      price: "520",
      cost: "220",
      images: [
        "https://images.unsplash.com/photo-1541643600914-78b084683702?auto=format&fit=crop&q=80",
      ],
      isFeatured: true,
      printBarcode: true,
      categoryIds: [catBySlug.unisex, catBySlug.men].filter(Boolean),
      variants: [
        { color: "50ml", size: "50ml", sku: "LAYLA-50", stock: 15, cost: 220 },
        { color: "100ml", size: "100ml", sku: "LAYLA-100", stock: 10, cost: 320 },
      ]
    });

    console.log("Featured products seeded");
  } else {
    const productCategoryMap: Record<string, string[]> = {
      "عطر العود الملكي": ["men", "oud"],
      "عطر آر اف المسك": ["women", "unisex"],
      "بخور دخون الفخامة": ["oud"],
      "عطر ليلة سعودية": ["unisex", "men"],
    };
    for (const p of products) {
      const slugs = productCategoryMap[p.name];
      if (slugs && (!p.categoryIds || p.categoryIds.length === 0)) {
        const ids = slugs.map(s => catBySlug[s]).filter(Boolean);
        if (ids.length > 0) {
          await storage.updateProduct(p.id, { categoryIds: ids });
          console.log(`Assigned ${p.name} to categories: ${slugs.join(", ")}`);
        }
      }
    }
  }

  // ── Seed Riyadh branches (Al-Malqa & Al-Suwaidi) ──────────────────────
  // Idempotent: only creates branches/managers if they don't already exist.
  const branchesToSeed = [
    {
      name: "فرع الملقا",
      nameEn: "Al-Malqa Branch",
      city: "الرياض",
      address: "حي الملقا، الرياض",
      mapUrl: "https://maps.app.goo.gl/o7EzqwwuqXLWwQLD9?g_st=ic",
      managerPhone: "9000010001",
      managerPassword: "Rf@22334466",
      sortOrder: 1,
    },
    {
      name: "فرع السويدي",
      nameEn: "Al-Suwaidi Branch",
      city: "الرياض",
      address: "حي السويدي، الرياض",
      mapUrl: "https://maps.app.goo.gl/3FmqmVGerY1W8HjFA",
      managerPhone: "9000010002",
      managerPassword: "Rf@22334455",
      sortOrder: 2,
    },
  ];

  for (const b of branchesToSeed) {
    let branch = await BranchModel.findOne({ name: b.name }).lean();
    if (!branch) {
      const created = await storage.createBranch({
        name: b.name,
        nameEn: b.nameEn,
        city: b.city,
        address: b.address,
        addressEn: "",
        email: "",
        hours: "",
        pickupHours: "",
        image: "",
        mapUrl: b.mapUrl,
        latitude: null,
        longitude: null,
        isPickupEnabled: true,
        sortOrder: b.sortOrder,
        isActive: true,
      } as any);
      branch = created as any;
      console.log(`[Seed] Branch created: ${b.name}`);
    } else if ((branch as any).mapUrl !== b.mapUrl) {
      await storage.updateBranch((branch as any)._id?.toString() || (branch as any).id, { mapUrl: b.mapUrl } as any);
    }

    const branchId = (branch as any)._id?.toString() || (branch as any).id;

    // Upsert a manager user for this branch (used internally by the
    // /branch-login endpoint — staff never type this phone).
    const existingMgr = await UserModel.findOne({ phone: b.managerPhone }).lean();
    if (!existingMgr) {
      const hashed = await hashPassword(b.managerPassword);
      await storage.createUser({
        name: `مسؤول ${b.name}`,
        phone: b.managerPhone,
        username: b.managerPhone,
        email: `${b.managerPhone}@rfperfume.sa`,
        password: hashed,
        role: "employee",
        branchId,
        loginType: "dashboard",
        isActive: true,
        mustChangePassword: false,
        walletBalance: "0",
        addresses: [],
        permissions: [
          "branch.orders", "branch.inventory", "branch.scan", "branch.manage",
          "orders.view", "products.view", "customers.view",
          "pos.access", "pos.use", "pos.close_shift",
        ],
        loyaltyPoints: 0,
        loyaltyTier: "bronze",
        totalSpent: 0,
        phoneDiscountEligible: false,
      } as any);
      console.log(`[Seed] Branch manager created for ${b.name}`);
    } else if ((existingMgr as any).branchId !== branchId) {
      // Re-link if branch was recreated
      await UserModel.updateOne(
        { _id: (existingMgr as any)._id },
        { $set: { branchId, role: "employee" } }
      );
    }
  }

  // Seed shipping companies
  const companies = await storage.getShippingCompanies();
  if (companies.length === 0) {
    await storage.createShippingCompany({
      name: "Storage Station",
      price: 20,
      estimatedDays: 3,
      isActive: true,
      storageXCode: "SS20"
    });
    console.log("Storage Station shipping seeded");
  }
}
