// CREATE NEW ORDER => /api/v1/orders/new

import catchAsyncErrorsMiddleware from '../middlewares/catchAsyncErrors.middleware.js';
import OrderModel from '../models/Order.model.js';
import productModel from '../models/product.model.js';
import ErrorHandler from '../Utils/ErrorHandler.js';

// ONLY FOR COD ORDERS
export const newOrder = catchAsyncErrorsMiddleware(async (req, res, next) => {
	const {
		orderItems,
		shippingInfo,
		itemsPrice,
		taxAmount,
		shippingAmount,
		totalAmount,
		paymentMethod,
		paymentInfo,
	} = req.body;

	const newOrder = await OrderModel.create({
		orderItems,
		shippingInfo,
		itemsPrice,
		taxAmount,
		shippingAmount,
		totalAmount,
		paymentMethod,
		paymentInfo,
		user: req.user._id,
	});

	res.status(200).json({
		newOrder,
	});
});

// GET ORDER DETAILS =>  /api/v1/orders/:id

export const getOrderDetails = catchAsyncErrorsMiddleware(
	async (req, res, next) => {
		const order = await OrderModel.findById(req.params.id).populate(
			'user',
			'name email'
		);

		if (!order) {
			return next(new ErrorHandler('No order found with this ID', 404));
		}

		res.status(200).json({
			order,
		});
	}
);

// GET CURRENT USERS ORDERS => /api/v1/me/orders
export const getMyOrders = catchAsyncErrorsMiddleware(
	async (req, res, next) => {
		const orders = await OrderModel.find({ user: req.user._id });

		if (!orders) {
			return next(new ErrorHandler('No order found with this ID', 404));
		}

		res.status(200).json({
			orders,
		});
	}
);

// GET All Orders For Admin =>  /api/v1/admin/orders

export const getAllOrders_admin = catchAsyncErrorsMiddleware(
	async (req, res, next) => {
		const orders = await OrderModel.find().populate('user', 'name email');

		res.status(200).json({
			orders,
		});
	}
);

// Update Order status - Admin =>  /api/v1/admin/orders/:id

export const updateOrder_admin = catchAsyncErrorsMiddleware(
	async (req, res, next) => {
		const order = await OrderModel.findById(req.params.id);

		if (!order) {
			return next(new ErrorHandler('No order found with this ID', 404));
		}

		if (order?.orderStatus === 'Shipped' && req.body.status === 'Shipped') {
			return next(
				new ErrorHandler(
					'Order is already shipped and awaiting delivery',
					400
				)
			);
		}

		if (order?.orderStatus === 'Delivered') {
			return next(
				new ErrorHandler('You have already delivered ths order', 400)
			);
		}

		order?.orderItems?.forEach(async (item) => {
			const product = await productModel.findById(
				item?.product?.toString()
			);

			if (!product) {
				return next(
					new ErrorHandler('No order found with this ID', 404)
				);
			}

			product.stock = product.stock - item.quantity;
			await product.save({ validateBeforeSave: false });
		});

		order.orderStatus = req.body.status;
		order.deliveredAt = Date.now();

		await order.save();

		res.status(200).json({
			success: true,
		});
	}
);

// DELETE ORDER => /api/v1/admin/orders/:id
export const deleteOrders_admin = catchAsyncErrorsMiddleware(
	async (req, res, next) => {
		const order = await OrderModel.findById(req.params.id);

		if (!order) {
			return next(new ErrorHandler('No order found with thi ID', 404));
		}

		await order.deleteOne();

		res.status(200).json({
			success: true,
		});
	}
);

// GET SALES
const getSalesData = async (startDate, endDate) => {
	try {
		const salesData = await OrderModel.aggregate([
			{
				// Stage 1 - Filter by Date Range
				$match: {
					createdAt: {
						$gte: new Date(startDate), // Start date filter
						$lte: new Date(endDate), // End date filter
					},
				},
			},
			{
				// Stage 2 - Group by Date and Sum Sales
				$group: {
					_id: {
						date: {
							$dateToString: {
								format: '%Y-%m-%d',
								date: '$createdAt',
							},
						}, // Group by day
					},
					totalSales: { $sum: '$totalAmount' }, // Sum up the sales
					numOfOrders: { $sum: 1 }, // Count number of orders
				},
			},
		]);

		console.log('SALES DATA:', salesData);

		return salesData;
	} catch (error) {
		console.error('Error fetching sales data: ', error);
		throw error;
	}
};

// GET SALES DATA => /api/v1/admin/getSales
export const get_Sales = catchAsyncErrorsMiddleware(async (req, res, next) => {
	const startDate = new Date(req.query.startDate);
	const endDate = new Date(req.query.endDate);

	startDate.setHours(0, 0, 0, 0);
	endDate.setHours(23, 59, 59, 999);

	getSalesData(startDate, endDate);
	
	res.status(200).json({
		success: true,
	});
});
