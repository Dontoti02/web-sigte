import { cn } from "@/lib/utils";
import Image from "next/image";

export const Logo = ({ className }: { className?: string }) => {
  return (
    <Image
      src="/icon.svg"
      alt="SIGTE Logo"
      width={40}
      height={40}
      className={cn("h-10 w-10", className)}
    />
  );
};
