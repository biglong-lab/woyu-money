import type { PaymentItem, SortOrder } from "./types";

// 格式化金額為台幣格式
export const formatAmount = (amount: string | number): string => {
  return new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency: "TWD",
    minimumFractionDigits: 0,
  }).format(Number(amount));
};

// 格式化日期為台灣日期格式
export const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString("zh-TW");
};

// 篩選付款項目（搜尋、分類、專案）
export const filterItems = (
  items: PaymentItem[],
  searchKeyword: string,
  selectedCategory: string,
  selectedProject: string
): PaymentItem[] => {
  let filtered = [...items];

  // 搜尋篩選
  if (searchKeyword) {
    const keyword = searchKeyword.toLowerCase();
    filtered = filtered.filter(
      (item) =>
        item.itemName.toLowerCase().includes(keyword) ||
        item.projectName.toLowerCase().includes(keyword) ||
        item.categoryName.toLowerCase().includes(keyword)
    );
  }

  // 分類篩選
  if (selectedCategory !== "all") {
    filtered = filtered.filter(
      (item) => item.categoryName === selectedCategory
    );
  }

  // 專案篩選
  if (selectedProject !== "all") {
    filtered = filtered.filter(
      (item) => item.projectName === selectedProject
    );
  }

  return filtered;
};

// 排序付款項目
export const sortItems = (
  items: PaymentItem[],
  sortBy: string,
  sortOrder: SortOrder
): PaymentItem[] => {
  const sorted = [...items];

  sorted.sort((a, b) => {
    let aValue: string | number;
    let bValue: string | number;

    switch (sortBy) {
      case "startDate":
        aValue = new Date(a.startDate).getTime();
        bValue = new Date(b.startDate).getTime();
        break;
      case "remainingAmount":
        aValue = parseFloat(a.remainingAmount);
        bValue = parseFloat(b.remainingAmount);
        break;
      case "itemName":
        aValue = a.itemName.toLowerCase();
        bValue = b.itemName.toLowerCase();
        break;
      default:
        aValue = a.itemName.toLowerCase();
        bValue = b.itemName.toLowerCase();
    }

    if (sortOrder === "asc") {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });

  return sorted;
};

// 計算分頁資料
export const paginateItems = <T>(
  items: T[],
  currentPage: number,
  itemsPerPage: number
): { paginatedItems: T[]; totalPages: number } => {
  const totalPages = Math.ceil(items.length / itemsPerPage);
  const paginatedItems = items.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return { paginatedItems, totalPages };
};
