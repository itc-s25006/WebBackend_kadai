// 仕様の「404: 指定された ID のデータが存在しない」の返却内容
export const notFoundBody = {
  errors: [{ name: "id", reason: "対象のデータが存在しません" }],
};