export const generateRecommendations = (percentage, pendingFields) => {
    const recommendations = [];
    
    if (percentage < 25) {
      recommendations.push("Your profile is very incomplete. Start by adding basic information like designation, location, and experience.");
    } else if (percentage < 50) {
      recommendations.push("Your profile needs significant improvement. Focus on completing required fields first.");
    } else if (percentage < 75) {
      recommendations.push("Your profile is partially complete. Add missing information to improve visibility.");
    } else if (percentage < 90) {
      recommendations.push("Your profile is almost complete. Add a few more details to make it perfect.");
    } else {
      recommendations.push("Excellent! Your profile is comprehensive and well-completed.");
    }
  
    // Add specific recommendations based on pending fields
    const criticalPending = pendingFields.filter(f => f.required);
    if (criticalPending.length > 0) {
      recommendations.push(`Complete these critical fields: ${criticalPending.map(f => f.field_name).join(', ')}`);
    }
  
    const hasNoProjects = pendingFields.some(f => f.field === 'projects');
    const hasNoExperience = pendingFields.some(f => f.field === 'experience');
    const hasNoAvailability = pendingFields.some(f => f.field === 'availability');
  
    if (hasNoProjects) {
      recommendations.push("Add at least one project to showcase your work and skills.");
    }
    if (hasNoExperience) {
      recommendations.push("Add your work experience to demonstrate your professional background.");
    }
    if (hasNoAvailability) {
      recommendations.push("Set your availability preferences to help recruiters understand your availability.");
    }
  
    return recommendations;
  }
  
