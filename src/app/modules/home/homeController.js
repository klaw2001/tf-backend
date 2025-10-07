import { PrismaClient } from '@prisma/client';
import { sendResponse } from '../../helpers/responseHelper.js';
import statusType from '../../enums/statusTypes.js';

const prisma = new PrismaClient();

/**
 * Get User Profile Controller
 * Fetches the complete profile information for the logged-in user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getUserProfile = async (req, res) => {
  try {
    const { user_id } = req.user;

    // Fetch user with role information
    const user = await prisma.user.findUnique({
      where: { user_id },
      select: {
        user_id: true,
        user_full_name: true,
        user_email: true,
        user_mobile: true,
        role_id: true,
        status: true,
        is_verified: true,
        is_active: true,
        created_at: true,
        updated_at: true,
        user_role: {
          select: {
            role_name: true
          }
        }
      }
    });

    if (!user) {
      return sendResponse(res, 'error', null, 'User not found', statusType.NOT_FOUND);
    }

    let profileData = {
      user: user
    };

    // Fetch role-specific profile data based on user role
    if (user.role_id === 3) { // Talent role (role_id 3 is talent)
      const talentProfile = await prisma.t_profile.findFirst({
        where: { 
          user_id: user_id,
          status: true
        },
        include: {
          t_projects: {
            where: { status: true },
            select: {
              tpj_id: true,
              tpj_name: true,
              tpj_description: true,
              tpj_url: true,
              tpj_github_url: true,
              tpj_duration: true,
              tpj_impact: true,
              tpj_technologies: true,
              tpj_images: true,
              created_at: true
            }
          },
          t_experience: {
            where: { status: true },
            select: {
              te_id: true,
              te_company_name: true,
              te_designation: true,
              te_location: true,
              te_start_date: true,
              te_end_date: true,
              te_description: true,
              te_technologies: true,
              created_at: true
            }
          },
          t_availability: {
            where: { status: true },
            select: {
              ta_id: true,
              ta_full_time: true,
              ta_full_min_salary: true,
              ta_full_max_salary: true,
              ta_part_time: true,
              ta_part_min_salary: true,
              ta_part_max_salary: true,
              ta_consulting: true,
              ta_consulting_min_salary: true,
              ta_consulting_max_salary: true,
              ta_work_location: true,
              ta_timezone: true
            }
          },
          t_skills: {
            where: { status: true },
            select: {
              ts_id: true,
              ts_skill: true,
              created_at: true
            }
          },
          t_reviews: {
            where: { status: true },
            select: {
              tr_id: true,
              tr_rating: true,
              tr_review: true,
              created_at: true
            }
          }
        }
      });

      if (talentProfile) {
        profileData.talentProfile = talentProfile;
      }
    } else if (user.role_id === 2) { // Recruiter role (role_id 2 is recruiter)
      const recruiterProfile = await prisma.r_profile.findFirst({
        where: { 
          user_id: user_id,
          status: true
        },
        include: {
          r_company_profile: {
            where: { status: true },
            select: {
              rc_id: true,
              rc_name: true,
              rc_website: true,
              rc_industry: true,
              rc_size: true,
              rc_role: true,
              rc_description: true,
              created_at: true
            }
          },
          r_individual_profile: {
            where: { status: true },
            select: {
              ri_id: true,
              ri_full_name: true,
              ri_email: true,
              ri_mobile: true,
              ri_linkedin_url: true,
              ri_portfolio_url: true,
              ri_about: true,
              created_at: true
            }
          }
        }
      });

      if (recruiterProfile) {
        profileData.recruiterProfile = recruiterProfile;
      }
    }

    return sendResponse(res, 'success', profileData, 'User profile retrieved successfully', statusType.SUCCESS);

  } catch (error) {
    console.error('Get user profile error:', error);
    return sendResponse(res, 'error', error.message, 'Internal server error while fetching user profile', statusType.INTERNAL_SERVER_ERROR);
  }
};

/**
 * Update User Profile Controller
 * Updates basic user information for the logged-in user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const updateUserProfile = async (req, res) => {
  try {
    const { user_id } = req.user;
    const { user_full_name, user_mobile } = req.body;

    // Validate required fields
    if (!user_full_name && !user_mobile) {
      return sendResponse(res, 'error', null, 'At least one field (user_full_name or user_mobile) is required', statusType.BAD_REQUEST);
    }

    // Check if mobile number is already taken by another user
    if (user_mobile) {
      const existingUser = await prisma.user.findFirst({
        where: {
          user_mobile: user_mobile,
          user_id: { not: user_id }
        }
      });

      if (existingUser) {
        return sendResponse(res, 'error', null, 'Mobile number is already taken by another user', statusType.BAD_REQUEST);
      }
    }

    // Update user information
    const updatedUser = await prisma.user.update({
      where: { user_id },
      data: {
        ...(user_full_name && { user_full_name }),
        ...(user_mobile && { user_mobile }),
        updated_at: new Date()
      },
      select: {
        user_id: true,
        user_full_name: true,
        user_email: true,
        user_mobile: true,
        role_id: true,
        status: true,
        is_verified: true,
        is_active: true,
        created_at: true,
        updated_at: true,
        user_role: {
          select: {
            role_name: true
          }
        }
      }
    });

    return sendResponse(res, 'success', { user: updatedUser }, 'User profile updated successfully', statusType.SUCCESS);

  } catch (error) {
    console.error('Update user profile error:', error);
    return sendResponse(res, 'error', error.message, 'Internal server error while updating user profile', statusType.INTERNAL_SERVER_ERROR);
  }
};

/**
 * Get User Dashboard Data Controller
 * Fetches dashboard-specific data for the logged-in user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getUserDashboard = async (req, res) => {
  try {
    const { user_id, role_id } = req.user;

    let dashboardData = {
      user_id,
      role_id,
      stats: {}
    };

    // Fetch role-specific dashboard statistics
    if (role_id === 2) { // Talent role
      const talentProfile = await prisma.t_profile.findFirst({
        where: { 
          user_id: user_id,
          status: true
        }
      });

      if (talentProfile) {
        const [projectsCount, experienceCount, skillsCount, reviewsCount] = await Promise.all([
          prisma.t_projects.count({ where: { tp_id: talentProfile.tp_id, status: true } }),
          prisma.t_experience.count({ where: { tp_id: talentProfile.tp_id, status: true } }),
          prisma.t_skills.count({ where: { tp_id: talentProfile.tp_id, status: true } }),
          prisma.t_reviews.count({ where: { tp_id: talentProfile.tp_id, status: true } })
        ]);

        dashboardData.stats = {
          projects: projectsCount,
          experience: experienceCount,
          skills: skillsCount,
          reviews: reviewsCount
        };
      }
    } else if (role_id === 3) { // Recruiter role
      const recruiterProfile = await prisma.r_profile.findFirst({
        where: { 
          user_id: user_id,
          status: true
        }
      });

      if (recruiterProfile) {
        // Add recruiter-specific stats here if needed
        dashboardData.stats = {
          profile_complete: !!recruiterProfile.r_company_profile || !!recruiterProfile.r_individual_profile
        };
      }
    }

    return sendResponse(res, 'success', dashboardData, 'Dashboard data retrieved successfully', statusType.SUCCESS);

  } catch (error) {
    console.error('Get user dashboard error:', error);
    return sendResponse(res, 'error', error.message, 'Internal server error while fetching dashboard data', statusType.INTERNAL_SERVER_ERROR);
  }
};


export default {
  getUserProfile,
  updateUserProfile,
  getUserDashboard
}