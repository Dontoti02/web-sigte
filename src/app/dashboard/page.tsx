import { Suspense } from 'react';
import { AdminDashboard } from '@/components/dashboard/admin-dashboard';
import { TeacherDashboard } from '@/components/dashboard/teacher-dashboard';
import { StudentDashboard } from '@/components/dashboard/student-dashboard';
import { ParentDashboard } from '@/components/dashboard/parent-dashboard';
import { Skeleton } from '@/components/ui/skeleton';

type Role = 'admin' | 'teacher' | 'student' | 'parent';

function DashboardContent({ role }: { role: Role }) {
  switch (role) {
    case 'admin':
      return <AdminDashboard />;
    case 'teacher':
      return <TeacherDashboard />;
    case 'student':
      return <StudentDashboard />;
    case 'parent':
      return <ParentDashboard />;
    default:
      return <StudentDashboard />;
  }
}

function DashboardSkeleton() {
    return (
        <div>
            <Skeleton className="h-8 w-1/3 mb-6" />
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Skeleton className="h-28" />
                <Skeleton className="h-28" />
                <Skeleton className="h-28" />
            </div>
        </div>
    );
}

export default function DashboardPage({
  searchParams,
}: {
  searchParams: { role?: Role };
}) {
  const role = searchParams.role || 'student';

  return (
    <div className="container mx-auto">
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent role={role} />
      </Suspense>
    </div>
  );
}
