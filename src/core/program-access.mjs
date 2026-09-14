// Public access is explicit: a missing or invalid price is never free.
export function isFreeProgram(program) {
    return program?.price === 0 || program?.price === '0';
}

export function canAccessProgram(program, user, isSubscribed = false) {
    if (!program) return false;
    if (isFreeProgram(program)) return true;
    if (!user) return false;
    if (isSubscribed) return true;
    return Array.isArray(user.userData?.purchasedTools) &&
        user.userData.purchasedTools.includes(program.id);
}

// Demo and free views remain available while auth initializes or on logout.
export function requiresSignedInUser(route, program, isDemoView = false) {
    if (route === 'admin' || route === 'account') return true;
    return route === 'program' && !isDemoView && !isFreeProgram(program);
}
