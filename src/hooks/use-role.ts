"use client";

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { Role } from '@/lib/types';
import { useUserProfile as useFirebaseUser } from '@/firebase';

export const useRole = () => {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const roleParam = searchParams.get('role') as Role;
    
    const { user: firebaseUser, isLoading, error } = useFirebaseUser();

    const role = (firebaseUser as any)?.role || roleParam || 'student';

    const user = firebaseUser 
        ? {
            ...firebaseUser,
            id: firebaseUser.uid,
            name: `${(firebaseUser as any).firstName || ''} ${(firebaseUser as any).lastName || ''}`.trim() || 'Usuario',
            photoURL: firebaseUser.photoURL || ''
          }
        : { // Provide a fallback mock user for display purposes when logged out or loading
            id: 'mock-user',
            name: 'Usuario',
            email: 'usuario@example.com',
            role: role,
            photoURL: ''
        };

    const switchRole = (newRole: Role) => {
        const params = new URLSearchParams(searchParams);
        params.set("role", newRole);
        router.replace(`${pathname}?${params.toString()}`);
    };

    return { role, user, switchRole, isLoading, error };
};
