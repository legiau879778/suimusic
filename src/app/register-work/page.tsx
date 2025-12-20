"use client";
import {useEffect,useState} from "react"; import {useRouter} from "next/navigation";
import styles from "@/styles/form.module.css";
import {getCurrentUser} from "@/lib/authStore";
import {getApprovedAuthorById} from "@/lib/authorStore";
import {addWork} from "@/lib/workStore";

export default function RegisterWork(){
  const r=useRouter(); const [title,setTitle]=useState(""); const [hash,setHash]=useState("");
  useEffect(()=>{
    const u=getCurrentUser();
    if(!u) return r.replace("/login");
    if(!u.authorId) return r.replace("/register-author");
    if(!getApprovedAuthorById(u.authorId)) return r.replace("/");
  },[]);
  return(
    <div className={styles.wrapper}>
      <h1 className={styles.title}>Đăng ký tác phẩm</h1>
      <div className={styles.field}>
        <label className={styles.label}>Tên tác phẩm</label>
        <input className={styles.input} value={title} onChange={e=>setTitle(e.target.value)}/>
      </div>
      <div className={styles.field}>
        <label className={styles.label}>SHA256</label>
        <input className={styles.input} value={hash} onChange={e=>setHash(e.target.value)}/>
      </div>
      <button className={styles.primary} onClick={()=>{
        const u=getCurrentUser(); if(!u?.authorId) return;
        addWork({title,authorId:u.authorId,fileHash:hash}); r.push("/manage");
      }}>Gửi đăng ký</button>
    </div>
  );
}
