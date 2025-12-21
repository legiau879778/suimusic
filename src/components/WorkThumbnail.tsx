import Image from "next/image";
import styles from "@/styles/workThumbnail.module.css";

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
        placeholder="blur"
        blurDataURL="/images/bg.png"
      />
      <span className={styles.label}>{label}</span>
    </div>
  );
}
