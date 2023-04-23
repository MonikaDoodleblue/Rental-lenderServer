const jwt = require('jsonwebtoken');
const infoModel = require('../model/infoModel')
const status = require('../validate/status')
const message = require('../validate/message')

const generateToken = (user) => {
    const tokenPayload = { id: user.id, name: user.name, email: user.email, role: user.role };
    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: '2h' });
    return { token };
};

const authenticate = (roles) => async (req, res, next) => {
    try {
        const token = req.headers.authorization && req.headers.authorization.split(' ')[1];
        if (!token) {
            return res.status(status.badRequest).json({ status: message.false, message: message.tokenMissing, token: null })
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        let user;
        if (decoded.role === 'admin' && roles.includes('admin')) {
            user = await infoModel.query().where('id', decoded.id).andWhere('role', 'admin').first();
        } else if (decoded.role === 'lender' && roles.includes('lender')) {
            user = await infoModel.query().where('id', decoded.id).andWhere('role', 'lender').first();
        } else if (decoded.role === 'renter' && roles.includes('renter')) {
            user = await infoModel.query().where('id', decoded.id).andWhere('role', 'renter').first();
        } else {
            return res.status(status.badRequest).json({ status: message.false, message: message.role });
        }

        if (!user) {
            return res.status(status.badRequest).json({ status: message.false, message: message.unauthorized });
        }

        req.user = {
            id: user.id,
            ...user,
        };

        if (roles.length && !roles.includes(user.role)) {
            return res.status(status.badRequest).json({ status: message.false, error: `Access denied. You do not have ${user.role} privileges.` })
        }

        next();

    } catch (error) {
        console.error(error);
        return res.status(status.unauthorized).json({ status: message.false, error: message.unauthorized });
    }
};

module.exports = {
    generateToken,
    authenticate
};