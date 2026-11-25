"use client";
import dynamic from "next/dynamic";

export const SalesAreaChart = dynamic(() => import("./SalesAreaChart"), { ssr: false, loading: () => <div className="skeleton h-[240px] w-full" /> });
export const CategoryDonut = dynamic(() => import("./CategoryDonut"), { ssr: false, loading: () => <div className="skeleton h-[240px] w-full" /> });
