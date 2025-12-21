import Image from "next/image";
import styles from "@/styles/workThumbnail.module.css";
import { BLUR_THUMB } from "@/lib/blur";

type Props = {
  src?: string;
  label?: string;
};

export default function WorkThumbnail({
  src = "/images/placeholder.png",
  label = "Digital Work",
}: Props) {
  return (
    <div className={styles.thumb}>
      <Image
        src={src}
        alt={label}
        fill
        sizes="(max-width: 768px) 70vw, 240px"
        className={styles.image}
        loading="lazy"
        placeholder="blur"
        blurDataURL={BLUR_THUMB}
      />
      <span className={styles.label}>{label}</span>
    </div>
  );
}
