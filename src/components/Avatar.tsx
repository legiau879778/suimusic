import Image from "next/image";
import styles from "@/styles/avatar.module.css";

type Props = {
  name?: string;
  src?: string;
};

export default function Avatar({ name = "U", src }: Props) {
  if (!src) {
    return <div className={styles.fallback}>{name[0]}</div>;
  }

  return (
    <Image
      src={src}
      alt={name}
      width={36}
      height={36}
      className={styles.avatar}
    />
  );
}
