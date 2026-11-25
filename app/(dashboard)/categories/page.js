"use client";
import { useState } from "react";
import EntityManager from "@/components/EntityManager";
import { useTable } from "@/lib/data";
import { Badge } from "@/components/ui";
import { cn } from "@/lib/cn";

export default function CategoriesPage() {
  const [tab, setTab] = useState("categories");
  const prodQ = useTable("products");
  const countFor = (id) => prodQ.rows.filter((p) => p.category_id === id).length;
  const brandCountFor = (id) => prodQ.rows.filter((p) => p.brand_id === id).length;

  return (
    <div>
      <div className="mb-6 flex gap-2">
        {[["categories", "Categories"], ["brands", "Brands"]].map(([v, l]) => (
          <button key={v} onClick={() => setTab(v)} className={cn("rounded-lg px-4 py-2 text-sm font-medium transition", tab === v ? "bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:ring-slate-300 dark:bg-slate-900 dark:ring-slate-700")}>{l}</button>
        ))}
      </div>
      {tab === "categories" ? (
        <EntityManager key="cat" title="Categories" sub="Organize products into categories" table="categories" entityName="Category" addLabel="Add Category"
          searchKeys={["name", "description"]}
          formDefaults={{ name: "", description: "", is_active: true }}
          fields={[
            { key: "name", label: "Category Name", required: true, placeholder: "e.g. Home & Kitchen" },
            { key: "description", label: "Description", type: "textarea", span: 2, placeholder: "Brief description of the category" },
          ]}
          columns={[
            { label: "Name", render: (c) => <span className="font-medium text-slate-800 dark:text-slate-100">{c.name}</span> },
            { label: "Description", render: (c) => <span className="text-slate-500">{c.description || "—"}</span> },
            { label: "Products", align: "center", render: (c) => countFor(c.id) },
            { label: "Status", render: (c) => c.is_active === false ? <Badge tone="red">Inactive</Badge> : <Badge tone="green">Active</Badge> },
          ]} />
      ) : (
        <EntityManager key="brand" title="Brands" sub="Product brands in your catalog — linked directly to products" table="brands" entityName="Brand" addLabel="Add Brand"
          searchKeys={["name", "description"]}
          formDefaults={{ name: "", description: "" }}
          fields={[
            { key: "name", label: "Brand Name", required: true, placeholder: "e.g. Sony" },
            { key: "description", label: "Description", type: "textarea", span: 2, placeholder: "e.g. Premium electronics" },
          ]}
          columns={[
            { label: "Name", render: (b) => <span className="font-medium text-slate-800 dark:text-slate-100">{b.name}</span> },
            { label: "Description", render: (b) => <span className="text-slate-500">{b.description || "—"}</span> },
            { label: "Products", align: "center", render: (b) => brandCountFor(b.id) },
          ]} />
      )}
    </div>
  );
}
