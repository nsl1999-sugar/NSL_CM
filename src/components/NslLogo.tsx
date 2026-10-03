import nslLogoLight from "@/assets/nsl-sugars-logo-light.png";
import nslLogoDark from "@/assets/nsl-sugars-logo-dark.png";
import { cn } from "@/lib/utils";

interface NslLogoProps {
  className?: string;
  alt?: string;
}

export const NslLogo = ({ className = "h-8", alt = "NSL Sugars" }: NslLogoProps) => {
  return (
    <>
      <img
        src={nslLogoLight}
        alt={alt}
        className={cn(className, "block dark:hidden")}
      />
      <img
        src={nslLogoDark}
        alt={alt}
        className={cn(className, "hidden dark:block")}
      />
    </>
  );
};
