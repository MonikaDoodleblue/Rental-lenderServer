const bcrypt = require('bcrypt');
const moment = require('moment-timezone');
const xlsx = require('xlsx');
const { generateToken } = require('../middleware/auth');
const categoryModel = require('../model/categoryModel');
const brandModel = require('../model/brandModel');
const productModel = require('../model/productModel');
const orderModel = require('../model/orderModel');
const infoModel = require('../model/infoModel');
const message = require('../validate/message')

function LenderService() { }

LenderService.prototype.create = async function (name, email, password, role) {
    try {
        const existingUser = await infoModel.query().findOne({ email });
        if (existingUser) {
            return { error: message.exists }
        }

        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        const lender = await infoModel.query().insert({ name, email, password: hashedPassword, role });

        return { lender };

    } catch (error) {
        return { error };
    }
};

LenderService.prototype.login = async function (email, password, role) {
    try {
        const lender = await infoModel.query().where({ 'email': email, 'role': role }).first();
        if (!lender) {
            return { error: message.email };
        }

        const passwordMatch = await bcrypt.compare(password, lender.password);
        if (!passwordMatch) {
            return { error: message.password };
        }

        const token = generateToken(lender);
        return { lender, token };

    } catch (error) {
        return { error };
    }
};

LenderService.prototype.createCategory = async function (categoryData) {
    try {
        const existingCategory = await categoryModel.query().findOne({ categoryName: categoryData.categoryName });
        if (existingCategory) {
            return { error: message.exists };
        }

        const category = await categoryModel.query().insert(categoryData);
        return { category };

    } catch (error) {
        return { error };
    }
};

LenderService.prototype.createBrand = async function (brandData) {
    try {
        const category = await categoryModel.query().findById(brandData.categoryId);

        if (!category) {
            return { error: message.categoryId };
        }

        const existingBrand = await brandModel.query().findOne({ brandName: brandData.brandName });

        if (existingBrand) {
            return { error: message.exists };
        }

        const brand = await brandModel.query().insert({
            brandName: brandData.brandName,
            categoryId: category.id
        });
        return { brand };

    } catch (error) {
        return { error };
    }
};

LenderService.prototype.createProduct = async function (productData) {
    try {
        const category = await categoryModel.query().findById(productData.categoryId);
        const brand = await brandModel.query().findById(productData.brandId);

        const existingProduct = await productModel.query().findOne({ productName: productData.productName });
        if (existingProduct) {
            return { error: 'product already exists' };
        }

        const product = await productModel.query().insert({
            productName: productData.productName,
            productDescription: productData.productDescription,
            productPrice: productData.productPrice,
            isForSale: productData.isForSale,
            isForRent: productData.isForRent,
            categoryId: category.id,
            brandId: brand.id,
            ownerId: productData.ownerId
        });
        return { product };

    } catch (error) {
        return { error };
    }
};

LenderService.prototype.getCategory = async function (limit, page, id, categoryName) {
    try {

        let offset = 0;
        if (limit && page) {
            offset = (page - 1) * limit;
        }

        let query = categoryModel.query();
        if (id) {
            query = query.where('id', id);
        }
        if (categoryName) {
            query = query.where('categoryName', 'like', `%${categoryName}%`);
        }

        const categoryCount = await query.resultSize();
        const totalPages = Math.ceil(categoryCount / limit);

        const category = await query.select()
            .limit(limit)
            .offset(offset);

        return {
            category,
            totalItems: categoryCount,
            currentPage: page,
            totalPages: totalPages
        };

    } catch (error) {
        return { error };
    }
};

LenderService.prototype.getBrand = async function (limit, page, id, brandName, categoryId) {
    try {

        let offset = 0;
        if (limit && page) {
            offset = (page - 1) * limit;
        }

        let query = brandModel.query();
        if (id) {
            query = query.where('id', id);
        }
        if (brandName) {
            query = query.where('brandName', 'like', `%${brandName}%`);
        }
        if (categoryId) {
            query = query.where('categoryId', categoryId);
        }

        const brandCount = await query.resultSize();
        const totalPages = Math.ceil(brandCount / limit);

        const brand = await query.select()
            .limit(limit)
            .offset(offset);

        return {
            brand,
            totalItems: brandCount,
            currentPage: page,
            totalPages: totalPages
        };

    } catch (error) {
        return { error };
    }
};

LenderService.prototype.getProduct = async function (limit, page, id, productName, brandId, categoryId) {
    try {

        let offset = 0;
        if (limit && page) {
            offset = (page - 1) * limit;
        }

        let query = productModel.query();
        if (id) {
            query = query.where('id', id);
        }
        if (productName) {
            query = query.where('productName', 'like', `%${productName}%`);
        }
        if (categoryId) {
            query = query.where('categoryId', categoryId);
        }
        if (brandId) {
            query = query.where('brandId', brandId);
        }

        const productCount = await query.resultSize();
        const totalPages = Math.ceil(productCount / limit);

        const product = await query.select()
            .limit(limit)
            .offset(offset);

        return {
            product,
            totalItems: productCount,
            currentPage: page,
            totalPages: totalPages
        };

    } catch (error) {
        return { error };
    }
};

LenderService.prototype.editProduct = async function (id, productData) {
    try {
        const updatedRows = await productModel.query().where({ id }).update(productData);
        if (!updatedRows) {
            return { error: message.productId }
        }

        const updatedProduct = await productModel.query().where({ id }).first();

        if (!updatedProduct) {
            return { error: message.productId }
        }

        return { updatedProduct };

    } catch (error) {
        return { error };
    }
};

LenderService.prototype.createSale = async function (order) {
    try {
        const product = await productModel
            .query()
            .select('productName', 'productDescription', 'productPrice', 'isForSale')
            .where({
                id: order.productId
            })
            .first();

        if (!product) {
            return { error: message.product };
        }
        if (!product.isForSale) {
            return { error: message.notAvailable };
        }

        const userSale = await orderModel.query().insert({
            productId: order.productId,
            userId: order.userId,
            orderDate: moment().tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss'),
            quantity: order.quantity,
            orderType: 'buy',
            role: 'lender',
            rentStart: order.rentStart || null,
            rentEnd: order.rentEnd || null,
            perDay: order.rentEnd || null,
            productPrice: product.productPrice,
            totalCost: product.productPrice * order.quantity,
        });
        return { product, userSale };

    } catch (error) {
        return { error };
    }
};

LenderService.prototype.createRent = async function (order) {
    try {
        const product = await productModel.query()
            .select('productName', 'productDescription', 'productPrice', 'isForRent')
            .where('id', order.productId)
            .first();

        if (!product) {
            return { error: message.product };
        }

        const existingOrder = await orderModel.query()
            .select('id')
            .where('productId', order.productId)
            .andWhere(function () {
                this.whereBetween('rentStart', [order.rentStart, order.rentEnd])
                    .orWhereBetween('rentEnd', [order.rentStart, order.rentEnd])
                    .orWhere(function () {
                        this.where('rentStart', '<=', order.rentStart)
                            .where('rentEnd', '>=', order.rentEnd)
                    });
            })
            .first()

        if (existingOrder) {
            return { error: message.booked };
        }
        if (!product.isForRent) {
            return { error: message.invalidRent };
        }

        if (moment(order.rentStart).isBefore(moment().startOf('day')) || moment(order.rentEnd).isSameOrBefore(moment(order.rentStart))) {
            return { error: message.date };
        }


        if (order.quantity <= 0) {
            return { error: message.quantity };
        }

        const numberOfDays = moment(order.rentEnd).diff(moment(order.rentStart), 'days') + 1;

        const userRent = await orderModel.query().insert({
            productId: order.productId,
            userId: order.userId,
            orderDate: moment().tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss'),
            quantity: order.quantity,
            orderType: 'rent',
            rentStart: order.rentStart,
            rentEnd: order.rentEnd,
            role: 'renter',
            perDay: 50.00,
            productPrice: product.productPrice,
            totalDays: numberOfDays,
            totalCost: product.productPrice * order.quantity + 50.00 * numberOfDays
        });
        return { userRent, product };

    } catch (error) {
        return { error };
    }
};

LenderService.prototype.deleteOrder = async function (id) {
    try {
        const deletedRows = await orderModel.query().deleteById(id);
        if (deletedRows === 0) {
            return { error: message.notFound };
        }
        return { deletedRows };

    } catch (error) {
        return { error };
    }
};

LenderService.prototype.getBuyOrRent = async function (limit, page, orderType) {
    try {
        let offset = 0;
        if (limit && page) {
            offset = (page - 1) * limit;
        }

        let myList;
        if (orderType !== 'buy' && orderType !== 'rent') {
            return { error: 'Invalid orderType' };
        }

        if (orderType === 'rent') {
            myList = await orderModel.query()
                .leftJoin('infoTable', 'orderTable.userId', 'infoTable.id')
                .leftJoin('productTable', 'orderTable.productId', 'productTable.id')
                .select(
                    'orderTable.id',
                    'infoTable.name',
                    'orderTable.orderDate',
                    'productTable.productName',
                    'orderTable.rentStart',
                    'orderTable.rentEnd',
                ).limit(limit)
                .offset(offset)
                .where((myRentals) => {
                    if (orderType) {
                        // myRentals.where('orderTable.userId', userId);
                        myRentals.where('orderTable.orderType', orderType);
                        myRentals.where('orderTable.role', 'renter');
                    } else {
                        return { error: 'Invalid orderType' };
                    }
                    myRentals.where('orderTable.role', 'renter');
                });

        } else if (orderType === 'buy') {
            myList = await orderModel.query()
                .leftJoin('infoTable', 'orderTable.userId', 'infoTable.id')
                .leftJoin('productTable', 'orderTable.productId', 'productTable.id')
                .select(
                    'orderTable.id',
                    'infoTable.name',
                    'productTable.productName',
                    'orderTable.orderDate'
                ).limit(limit)
                .offset(offset)
                .where((myCloset) => {
                    if (orderType) {
                        myCloset.where('orderTable.orderType', orderType);
                    } else {
                        return { error: 'Invalid orderType' };
                    }
                    // myCloset.where('orderTable.userId', userId);
                    myCloset.where('orderTable.orderType', orderType);
                    myCloset.where('orderTable.role', 'lender');
                });
        }

        return { myList };

    } catch (error) {
        console.error(error);
        logger.error('unable to fetch', { error });
        return { error: 'Internal server error' };
    }
};

LenderService.prototype.getMyList = async function (userId, limit, page, orderType) {
    try {
        let offset = 0;
        if (limit && page) {
            offset = (page - 1) * limit;
        }

        let myList;
        if (orderType !== 'buy' && orderType !== 'rent') {
            return { error: 'Invalid orderType' };
        }

        if (orderType === 'rent') {
            myList = await orderModel.query()
                .leftJoin('infoTable', 'orderTable.userId', 'infoTable.id')
                .leftJoin('productTable', 'orderTable.productId', 'productTable.id')
                .select(
                    'orderTable.id',
                    'infoTable.name',
                    'orderTable.orderDate',
                    'productTable.productName',
                    'orderTable.rentStart',
                    'orderTable.rentEnd',
                ).limit(limit)
                .offset(offset)
                .where((myRentals) => {
                    if (orderType) {
                        myRentals.where('orderTable.userId', userId);
                        myRentals.where('orderTable.orderType', orderType);
                        myRentals.where('orderTable.role', 'renter');
                    } else {
                        return { error: 'Invalid orderType' };
                    }
                    myRentals.where('orderTable.role', 'renter');
                });

        } else if (orderType === 'buy') {
            myList = await orderModel.query()
                .leftJoin('infoTable', 'orderTable.userId', 'infoTable.id')
                .leftJoin('productTable', 'orderTable.productId', 'productTable.id')
                .select(
                    'orderTable.id',
                    'infoTable.name',
                    'productTable.productName',
                    'orderTable.orderDate'
                ).limit(limit)
                .offset(offset)
                .where((myCloset) => {
                    if (orderType) {
                        myCloset.where('orderTable.orderType', orderType);
                    } else {
                        return { error: 'Invalid orderType' };
                    }
                    myCloset.where('orderTable.userId', userId);
                    myCloset.where('orderTable.orderType', orderType);
                    myCloset.where('orderTable.role', 'lender');
                });
        }

        return { myList };

    } catch (error) {
        console.error(error);
        logger.error('unable to fetch', { error });
        return { error: 'Internal server error' };
    }
};

LenderService.prototype.getAllUsers = async function (limit, page) {
    try {

        let query = infoModel.query().select('id', 'name', 'email', 'role', 'status');

        if (limit && page) {
            const offset = (page - 1) * limit;
            query = query.limit(limit).offset(offset);
        }

        const users = await query;
        return users;

    } catch (error) {
        return { error };
    }
};

LenderService.prototype.getUsers = async function (id, name, role) {
    try {
        let users;
        if (id) {
            users = await infoModel.query().where('id', id).select();
        } else if (name) {
            users = await infoModel.query().where('name', name).select();
        }
        else if (role) {
            users = await infoModel.query().where('role', role).select();
        }
        if (!users) {
            return { error: message.notFound }
        }
        return { users };
    } catch (error) {
        return { error };
    }
};

LenderService.prototype.getOrders = async function (limit, page, id, userId) {
    try {
        let query = orderModel.query();

        if (limit && page) {
            const offset = (page - 1) * limit;
            query = query.limit(limit).offset(offset);
        }

        const orders = await query
            .leftJoin('producttable', 'ordertable.productId', 'producttable.id')
            .leftJoin('infotable', 'ordertable.userId', 'infotable.id')
            .select(
                'ordertable.id',
                'infotable.name',
                'ordertable.role',
                'producttable.productName',
                'ordertable.quantity',
                'producttable.productPrice',
                'ordertable.totalCost',
                'ordertable.orderDate'
            )
            .where((orders) => {
                if (id) {
                    orders.where('ordertable.id', id);
                }
                if (userId) {
                    orders.where('infotable.id', userId);
                }
            })
        return { orders };

    } catch (error) {
        return { error };
    }
};

LenderService.prototype.uploadCategory = async function (file) {
    try {
        if (!file) {
            throw new Error('No file uploaded');
        }
        const workbook = xlsx.read(file.data, { type: 'buffer' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = xlsx.utils.sheet_to_json(sheet);
        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            const category = {
                categoryName: row.categoryName
            };
            await categoryModel.query().insert(category);
        }
    } catch (error) {
        return { error };
    }
};

LenderService.prototype.uploadBrand = async function (file) {
    try {
        if (!file) {
            throw new Error('No file uploaded');
        }
        const workbook = xlsx.read(file.data, { type: 'buffer' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = xlsx.utils.sheet_to_json(sheet);
        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            const brand = {
                brandName: row.brandName,
                categoryId: row.categoryId
            };
            await brandModel.query().insert(brand);
        }
    } catch (error) {
        return { error };
    }
};

LenderService.prototype.uploadProduct = async function (file) {
    try {
        if (!file) {
            throw new Error('No file uploaded');
        }
        const workbook = xlsx.read(file.data, { type: 'buffer' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = xlsx.utils.sheet_to_json(sheet);
        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            const product = {
                productName: row.productName,
                productDescription: row.productDescription,
                productPrice: row.productPrice,
                isForSale: row.isForSale,
                isForRent: row.isForRent,
                brandId: row.brandId,
                categoryId: row.categoryId,
                ownerId: row.ownerId
            };
            await productModel.query().insert(product);
        }
    } catch (error) {
        return { error };
    }
};

LenderService.prototype.searchAll = async function (search, limit, page, productName, categoryName, brandName) {

    try {
        const query = productModel.query()
            .leftJoin('categorytable', 'producttable.categoryId', 'categorytable.id')
            .leftJoin('brandtable', 'producttable.brandId', 'brandtable.id')
            .select(
                'categorytable.categoryName AS category',
                'producttable.productName AS productName',
                'brandtable.id AS brandId',
                'brandtable.brandName AS brandName'
            );

        // Filter by search parameter
        if (search) {
            query.where(function () {
                this.where('producttable.productName', 'LIKE', `%${search}%`)
                    .orWhere('categorytable.categoryName', 'LIKE', `%${search}%`)
                    .orWhere('brandtable.brandName', 'LIKE', `%${search}%`);
            });
        }

        // Filter by productName
        if (productName) {
            query.where('producttable.productName', 'LIKE', `%${productName}%`);
        }

        // Filter by categoryName
        if (categoryName) {
            query.where('categorytable.categoryName', 'LIKE', `%${categoryName}%`);
        }

        // Filter by brandName
        if (brandName) {
            query.where('brandtable.brandName', 'LIKE', `%${brandName}%`);
        }

        const totalItemsQuery = productModel.query()
            .leftJoin('categorytable', 'producttable.categoryId', 'categorytable.id')
            .leftJoin('brandtable', 'producttable.brandId', 'brandtable.id')
            .count('producttable.id as count');

        // Apply the same filters to the totalItemsQuery
        if (search) {
            totalItemsQuery.where(function () {
                this.where('producttable.productName', 'LIKE', `%${search}%`)
                    .orWhere('categorytable.categoryName', 'LIKE', `%${search}%`)
                    .orWhere('brandtable.brandName', 'LIKE', `%${search}%`);
            });
        }

        if (productName) {
            totalItemsQuery.where('producttable.productName', 'LIKE', `%${productName}%`);
        }

        if (categoryName) {
            totalItemsQuery.where('categorytable.categoryName', 'LIKE', `%${categoryName}%`);
        }

        if (brandName) {
            totalItemsQuery.where('brandtable.brandName', 'LIKE', `%${brandName}%`);
        }

        const totalItems = await totalItemsQuery.first();

        // Paginate results
        if (limit && page) {
            const offset = (page - 1) * limit;
            query.limit(limit).offset(offset);
        }

        const products = await query;

        const categories = {};
        products.forEach(product => {
            if (!categories[product.category]) {
                categories[product.category] = [];
            }
            categories[product.category].push({
                productName: product.productName,
                brand: { id: product.brandId, name: product.brandName }
            });
        });

        // const count = products.length;
        const totalPages = Math.ceil(totalItems.count / limit);
        const currentPage = page;
        return { categories, totalItems: totalItems.count, totalPages, currentPage };

    } catch (error) {
        console.log(error);
    }
};

LenderService.prototype.searchItemManagement = async function (id, ownerName, sortBy, page, limit) {
    try {
        const offset = (page - 1) * limit;
        let query = productModel.query();
        let items;
        let totalItems = 0;

        if (!id && !sortBy && !ownerName) {
            query.orderBy('productTable.id', 'asc');
        }
        if (ownerName) {
            query.where('infotable.name', 'like', `%${ownerName}%`);
        }

        if (sortBy) {
            query.orderBy('productTable.id', sortBy == 'asc' ? 'asc' : 'desc');
        }

        if (id) {
            query.where('productTable.id', 'like', `%${id}%`);
        }

        totalItems = await query.resultSize();
        query.leftJoin('infotable', 'productTable.ownerId', 'infotable.id').limit(limit).offset(offset);
        items = await query.select(['productTable.id as productId', 'infotable.name as ownerName', 'productTable.created_at']);
        const totalPages = Math.ceil(totalItems / limit);
        const currentPage = page;

        return { items, totalItems, totalPages, currentPage };
    } catch (error) {
        return { error };
    }
}

LenderService.prototype.searchOrderManagement = async function (id, renterName, lenderName, productId, productName, orderType, sortBy, page, limit) {
    try {
        let query = orderModel.query();
        let orders = [];
        let totalItems = 0;
        query.leftJoin('productTable', 'orderTable.productId', 'productTable.id')
            .leftJoin('infoTable as renterInfo', 'orderTable.userId', 'renterInfo.id')
            .leftJoin('productTable as productTableLender', 'productTable.ownerId', 'productTableLender.id')
            .leftJoin('infoTable as lenderInfo', 'productTableLender.ownerId', 'lenderInfo.id');

        if (!id && !renterName && !lenderName && !productName && !productId && !orderType && !sortBy) {
            query.orderBy('orderTable.id', 'asc');
        } else {
            if (id) {
                query.where('orderTable.id', 'like', `%${id}%`);
            }
            if (productId) {
                query.where('orderTable.productId', 'like', `%${productId}%`);
            }
            if (sortBy) {
                query.orderBy('orderTable.id', sortBy == 'asc' ? 'asc' : 'desc');
            }
            if (productName) {
                query.where('productTable.productName', 'like', `%${productName}%`);
            }
            if (renterName) {
                query.where('renterInfo.name', 'like', `%${renterName}%`);
            }
            if (lenderName) {
                query.where('lenderInfo.name', 'like', `%${lenderName}%`);
            }
        }

        const countQuery = query.clone();
        const countResult = await countQuery.count('orderTable.id as count');
        totalItems = countResult[0].count;
        const offset = (page - 1) * limit;
        query.limit(limit).offset(offset);
        orders = await query.select([
            'orderTable.id',
            'orderTable.orderDate',
            'orderTable.productId',
            'orderTable.orderType',
            'productTable.productName',
            'renterInfo.name as renterName',
            'lenderInfo.name as lenderName'
        ]);

        const totalPages = Math.ceil(totalItems / limit);
        const currentPage = page > totalPages ? totalPages : page;

        return {
            orders,
            totalItems,
            totalPages,
            currentPage
        };
    } catch (error) {
        return { error };
    }
};

LenderService.prototype.getItemsById = async function (id) {
    try {
        const product = await productModel.query().findById(id);

        if (!product) {
            return { error: message.Not_Found };
        }

        let query = productModel.query()
            .distinct('productTable.*')
            .select(productModel.raw('SUM(CASE WHEN orderTable.role = "renter" THEN orderTable.totalDays ELSE 0 END) as totalDays'))
            .select(productModel.raw('SUM(CASE WHEN orderTable.role = "renter" THEN 1 ELSE 0 END) as timesRented'))
            .select(productModel.raw('SUM(CASE WHEN orderTable.role = "lender" THEN orderTable.quantity ELSE 0 END) as itemSold'))
            .leftJoin('orderTable', 'productTable.id', '=', 'orderTable.productId')
            .where('productTable.id', id)
            .groupBy('productTable.id');

        let items = await query;
        return { items };
    } catch (error) {
        return { error };
    }
};

LenderService.prototype.getOrdersById = async function (id) {
    try {
        const orders = await orderModel.query().findById(id);

        if (!orders) {
            return { error: message.Not_Found };
        }

        let query = await orderModel.query()
            .leftJoin('infoTable as renterInfo', 'orderTable.userId', 'renterInfo.id')
            .leftJoin('productTable', 'orderTable.productId', 'productTable.id')
            .leftJoin('infoTable as lenderInfo', 'productTable.ownerId', 'lenderInfo.id')
            .select('orderTable.id', 'orderTable.productId', 'orderTable.productPrice', 'orderTable.quantity', 'orderTable.totalCost', 'renterInfo.name as renterName', 'renterInfo.email as renterEmail', 'lenderInfo.name as lenderName', 'lenderInfo.email as lenderEmail', 'orderTable.orderType')
            .where('orderTable.id', id)
            .first();

        if (orders && orders.orderType === 'rent') {
            let rentInfo = await orderModel.query()
                .select('rentStart', 'rentEnd')
                .where('id', id)
                .andWhere('orderType', 'rent')
                .first();

            orders.rentStart = rentInfo.rentStart;
            orders.rentEnd = rentInfo.rentEnd;
        } else if (orders && orders.orderType === 'buy') {
            orders.rentStart = 0;
            orders.rentEnd = 0;
        }
        let order = await query;
        return { order };
    } catch (error) {
        return { error };
    }
};

LenderService.prototype.editItems = async function (id, brandName, categoryName) {
    try {
        const product = await productModel.query()
            .findById(id)
            .leftJoin('brandTable', 'productTable.brandId', 'brandTable.id')
            .leftJoin('categoryTable', 'productTable.categoryId', 'categoryTable.id')
            .select('productTable.*', 'brandTable.brandName as brandName', 'categoryTable.categoryName as categoryName');

        if (!product) {
            return { error: message.Not_Found };
        }
        await brandModel.query()
            .findById(product.brandId)
            .patch({ brandName });

        await categoryModel.query()
            .findById(product.categoryId)
            .patch({ categoryName });

        const item = await productModel.query()
            .findById(id)
            .leftJoin('brandTable', 'productTable.brandId', 'brandTable.id')
            .leftJoin('categoryTable', 'productTable.categoryId', 'categoryTable.id')
            .select('productTable.id', 'productTable.productName', 'productTable.brandId', 'productTable.categoryId', 'brandTable.brandName as brandName', 'categoryTable.categoryName as categoryName');

        return { item };
    } catch (error) {
        return { error };

    }
};

LenderService.prototype.deleteProduct = async function (id) {
    try {
        const deletedRows = await productModel.query().deleteById(id);
        if (deletedRows === 0) {
            return { error: message.notFound };
        }
        return { deletedRows };

    } catch (error) {
        return { error };
    }
};

LenderService.prototype.masterData = async function (positionA, positionB) {
    try {
        const category = await categoryModel.query().select('categoryTable.categoryName');
        const categoryNames = category.map(item => item.categoryName);

        if (positionA < 0 || positionA >= categoryNames.length || positionB < 0 || positionB >= categoryNames.length) {
            return { error: message.Invalid_positions }
        }

        [categoryNames[positionA], categoryNames[positionB]] = [categoryNames[positionB], categoryNames[positionA]];

        const updatedResponse = { categoryName: categoryNames };

        return { updatedResponse };
    } catch (error) {
        return { error };
    }
};

module.exports = new LenderService();