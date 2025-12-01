import express from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const router = express.Router();
const prisma = new PrismaClient();

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

// Create dummy user with complete profile data
router.post('/create-dummy-user', async (req, res) => {
    try {
        const { role } = req.query;
        
        if (!role || !['talent', 'recruiter'].includes(role.toLowerCase())) {
            return res.status(400).json({
                success: false,
                message: 'Role is required and must be either "talent" or "recruiter"'
            });
        }

        // Get role_id from database
        const roleData = await prisma.role.findFirst({
            where: {
                role_name: role.toLowerCase()
            }
        });

        if (!roleData) {
            return res.status(404).json({
                success: false,
                message: `Role "${role}" not found in database`
            });
        }

        const roleId = roleData.role_id;
        const timestamp = Date.now();
        const randomNum = Math.floor(Math.random() * 10000);

        // Generate dummy user data
        const dummyUserData = {
            user_full_name: role === 'talent' 
                ? `Dummy Talent ${randomNum}` 
                : `Dummy Recruiter ${randomNum}`,
            user_email: `dummy.${role}.${timestamp}@example.com`,
            user_mobile: `+91${9000000000 + randomNum}`,
            user_password: await bcrypt.hash('Dummy@123', 12),
            role_id: roleId,
            status: true,
            is_verified: true,
            is_active: true,
            is_deleted: false,
            is_blocked: false,
            is_suspended: false
        };

        // Create user and all related profile data in a transaction
        const result = await prisma.$transaction(async (tx) => {
            // Create user
            const newUser = await tx.user.create({
                data: dummyUserData
            });

            if (role === 'talent') {
                // Create talent profile
                const talentProfile = await tx.t_profile.create({
                    data: {
                        user_id: newUser.user_id,
                        tp_designation: 'Senior Software Engineer',
                        tp_location: 'Bangalore, India',
                        tp_total_experience: '5-7 years',
                        tp_about: 'Experienced software engineer with expertise in full-stack development. Passionate about building scalable applications and solving complex problems.',
                        tp_professional_summary: '5+ years of experience in software development with strong skills in JavaScript, Node.js, React, and cloud technologies. Proven track record of delivering high-quality software solutions.',
                        tp_resume: null,
                        tp_image: null,
                        status: true
                    }
                });

                // Create talent projects
                await tx.t_projects.createMany({
                    data: [
                        {
                            tp_id: talentProfile.tp_id,
                            tpj_name: 'E-Commerce Platform',
                            tpj_description: 'Built a full-stack e-commerce platform with React and Node.js',
                            tpj_url: 'https://example.com/project1',
                            tpj_github_url: 'https://github.com/example/project1',
                            tpj_duration: '6 months',
                            tpj_impact: 'Increased sales by 40% and improved user experience',
                            tpj_technologies: 'React, Node.js, MongoDB, AWS',
                            tpj_images: null,
                            status: true
                        },
                        {
                            tp_id: talentProfile.tp_id,
                            tpj_name: 'Mobile Banking App',
                            tpj_description: 'Developed a secure mobile banking application with real-time transactions',
                            tpj_url: 'https://example.com/project2',
                            tpj_github_url: 'https://github.com/example/project2',
                            tpj_duration: '8 months',
                            tpj_impact: 'Served 100K+ users with 99.9% uptime',
                            tpj_technologies: 'React Native, Node.js, PostgreSQL, Redis',
                            tpj_images: null,
                            status: true
                        }
                    ]
                });

                // Create talent experience
                await tx.t_experience.createMany({
                    data: [
                        {
                            tp_id: talentProfile.tp_id,
                            te_company_name: 'Tech Corp Inc.',
                            te_designation: 'Senior Software Engineer',
                            te_location: 'Bangalore, India',
                            te_start_date: new Date('2020-01-01'),
                            te_end_date: new Date('2023-12-31'),
                            te_description: 'Led development of microservices architecture. Mentored junior developers and improved code quality.',
                            te_technologies: 'Node.js, React, Docker, Kubernetes, AWS',
                            status: true
                        },
                        {
                            tp_id: talentProfile.tp_id,
                            te_company_name: 'StartupXYZ',
                            te_designation: 'Software Engineer',
                            te_location: 'Remote',
                            te_start_date: new Date('2018-06-01'),
                            te_end_date: new Date('2019-12-31'),
                            te_description: 'Developed RESTful APIs and frontend components. Collaborated with cross-functional teams.',
                            te_technologies: 'JavaScript, Express.js, React, MongoDB',
                            status: true
                        }
                    ]
                });

                // Create talent availability
                await tx.t_availability.create({
                    data: {
                        tp_id: talentProfile.tp_id,
                        ta_full_time: true,
                        ta_full_min_salary: 1500000,
                        ta_full_max_salary: 2500000,
                        ta_part_time: true,
                        ta_part_min_salary: 50000,
                        ta_part_max_salary: 100000,
                        ta_consulting: true,
                        ta_consulting_min_salary: 2000,
                        ta_consulting_max_salary: 5000,
                        ta_work_location: 'Remote',
                        ta_timezone: 'IST',
                        status: true
                    }
                });

                // Create talent skills
                await tx.t_skills.createMany({
                    data: [
                        { tp_id: talentProfile.tp_id, ts_skill: 'JavaScript', status: true },
                        { tp_id: talentProfile.tp_id, ts_skill: 'Node.js', status: true },
                        { tp_id: talentProfile.tp_id, ts_skill: 'React', status: true },
                        { tp_id: talentProfile.tp_id, ts_skill: 'TypeScript', status: true },
                        { tp_id: talentProfile.tp_id, ts_skill: 'PostgreSQL', status: true },
                        { tp_id: talentProfile.tp_id, ts_skill: 'MongoDB', status: true },
                        { tp_id: talentProfile.tp_id, ts_skill: 'AWS', status: true },
                        { tp_id: talentProfile.tp_id, ts_skill: 'Docker', status: true },
                        { tp_id: talentProfile.tp_id, ts_skill: 'Kubernetes', status: true },
                        { tp_id: talentProfile.tp_id, ts_skill: 'Git', status: true }
                    ]
                });

                // Create talent reviews
                await tx.t_reviews.createMany({
                    data: [
                        {
                            tp_id: talentProfile.tp_id,
                            tr_rating: 5,
                            tr_review: 'Excellent developer with great problem-solving skills. Highly recommended!',
                            status: true
                        },
                        {
                            tp_id: talentProfile.tp_id,
                            tr_rating: 4,
                            tr_review: 'Very professional and delivered quality work on time.',
                            status: true
                        },
                        {
                            tp_id: talentProfile.tp_id,
                            tr_rating: 5,
                            tr_review: 'Outstanding communication and technical expertise.',
                            status: true
                        }
                    ]
                });

                return {
                    user: newUser,
                    profile: talentProfile,
                    profileType: 'talent'
                };
            } else {
                // Create recruiter profile
                const recruiterProfile = await tx.r_profile.create({
                    data: {
                        user_id: newUser.user_id,
                        rp_profile_image: null,
                        rp_type: 'company',
                        status: true
                    }
                });

                // Create company profile
                await tx.r_company_profile.create({
                    data: {
                        rp_id: recruiterProfile.rp_id,
                        rc_name: `Dummy Company ${randomNum}`,
                        rc_website: `https://company${randomNum}.example.com`,
                        rc_industry: 'Technology',
                        rc_size: '51-200',
                        rc_role: 'HR Manager',
                        rc_description: 'Leading technology company focused on innovation and excellence. We are looking for talented individuals to join our growing team.',
                        status: true
                    }
                });

                // Also create individual profile for completeness
                await tx.r_individual_profile.create({
                    data: {
                        rp_id: recruiterProfile.rp_id,
                        ri_full_name: dummyUserData.user_full_name,
                        ri_email: dummyUserData.user_email,
                        ri_mobile: dummyUserData.user_mobile,
                        ri_linkedin_url: `https://linkedin.com/in/dummy-recruiter-${randomNum}`,
                        ri_portfolio_url: `https://portfolio${randomNum}.example.com`,
                        ri_about: 'Experienced HR professional with expertise in talent acquisition and recruitment. Passionate about connecting great talent with great opportunities.',
                        status: true
                    }
                });

                return {
                    user: newUser,
                    profile: recruiterProfile,
                    profileType: 'recruiter'
                };
            }
        });

        return res.json({
            success: true,
            message: `Dummy ${role} user created successfully`,
            data: {
                user: {
                    user_id: result.user.user_id,
                    user_full_name: result.user.user_full_name,
                    user_email: result.user.user_email,
                    user_mobile: result.user.user_mobile,
                    role_id: result.user.role_id
                },
                profile: result.profile,
                profileType: result.profileType,
                password: 'Dummy@123' // Return password for testing purposes
            }
        });

    } catch (error) {
        console.error('Error creating dummy user:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to create dummy user',
            error: error.message
        });
    }
});

export default router;