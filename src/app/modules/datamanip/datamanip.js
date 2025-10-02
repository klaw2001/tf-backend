import express from 'express';
const router = express.Router();

router.route('/create-roles').post(async (req, res) => {
    const roles = [
        {
            role_name: 'admin'
        },
        {
            role_name: 'recruiter'
        },
        {
            role_name: 'talent'
        }
    ]
    const role = await prisma.role.createMany({
        data: roles
    });
    res.json(roles);
});


router.get('/users', async (req, res) => {
    try {
        const users = await prisma.user.findMany();
        res.json({
            success: true,
            data: users
        });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch users'
        });
    }
});



export default router;