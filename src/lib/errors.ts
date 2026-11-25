// 仕様の「404: 指定された ID のデータが存在しない」の返却内容
export const notFoundBody = {
  errors: [{ name: "id", reason: "対象のデータが存在しません" }],
};

// 仕様の「403: 作成者以外による変更など権限がなかった場合」の返却内容
export const forbiddenBody = {
  errors: [{ name: "perm", reason: "変更できませんでした" }],
};