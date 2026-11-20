<script setup>
// 飲品管理表格：總部用來管理共用菜單、店長用來管理本店特色飲品
import { reactive, ref } from 'vue';
import { money } from '../api.js';

const props = defineProps({
  items: { type: Array, required: true },
  allowDelete: { type: Boolean, default: false },
  addLabel: { type: String, default: '新增飲品' },
});
const emit = defineEmits(['create', 'update', 'remove']);

const editingId = ref(null);
const draft = reactive({ name: '', price: '', description: '', isActive: true });
const adding = ref(false);
const blank = reactive({ name: '', price: '', description: '', isActive: true });

function startEdit(d) {
  editingId.value = d.id;
  Object.assign(draft, { name: d.name, price: d.price, description: d.description, isActive: d.isActive });
}
function saveEdit() {
  emit('update', { id: editingId.value, ...draft });
  editingId.value = null;
}
function saveNew() {
  emit('create', { ...blank });
  Object.assign(blank, { name: '', price: '', description: '', isActive: true });
  adding.value = false;
}
function toggle(d) {
  emit('update', { ...d, isActive: !d.isActive });
}
function remove(d) {
  if (window.confirm(`確定要刪除「${d.name}」嗎？`)) emit('remove', d.id);
}
</script>

<template>
  <div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>名稱</th><th>說明</th><th class="num">價格</th><th>狀態</th><th></th></tr>
        </thead>
        <tbody>
          <tr v-for="d in props.items" :key="d.id">
            <template v-if="editingId === d.id">
              <td><input v-model="draft.name" maxlength="100" /></td>
              <td><input v-model="draft.description" maxlength="500" /></td>
              <td class="num"><input v-model.number="draft.price" type="number" min="0" style="width: 6em" /></td>
              <td><label><input v-model="draft.isActive" type="checkbox" style="width: auto" /> 上架</label></td>
              <td class="actions">
                <button class="btn small" @click="saveEdit">儲存</button>
                <button class="btn ghost small" @click="editingId = null">取消</button>
              </td>
            </template>
            <template v-else>
              <td>{{ d.name }}</td>
              <td class="muted">{{ d.description }}</td>
              <td class="num">{{ money(d.price) }}</td>
              <td>
                <span class="badge" :class="d.isActive ? 'ok' : 'off'">{{ d.isActive ? '上架中' : '已下架' }}</span>
              </td>
              <td class="actions">
                <button class="btn ghost small" @click="startEdit(d)">編輯</button>
                <button class="btn ghost small" @click="toggle(d)">{{ d.isActive ? '下架' : '上架' }}</button>
                <button v-if="allowDelete" class="btn danger small" @click="remove(d)">刪除</button>
              </td>
            </template>
          </tr>
          <tr v-if="!props.items.length">
            <td colspan="5" class="muted">目前沒有飲品</td>
          </tr>
        </tbody>
      </table>
    </div>

    <form v-if="adding" class="add-form" @submit.prevent="saveNew">
      <label class="field"><span>名稱</span><input v-model="blank.name" required maxlength="100" /></label>
      <label class="field"><span>價格</span><input v-model.number="blank.price" type="number" min="0" required /></label>
      <label class="field wide"><span>說明</span><input v-model="blank.description" maxlength="500" /></label>
      <div class="form-actions">
        <button class="btn" type="submit">新增</button>
        <button class="btn ghost" type="button" @click="adding = false">取消</button>
      </div>
    </form>
    <button v-else class="btn ghost add-btn" @click="adding = true">＋ {{ addLabel }}</button>
  </div>
</template>

<style scoped>
.actions { white-space: nowrap; display: flex; gap: 6px; }
.add-btn { margin-top: 12px; }
.add-form { margin-top: 16px; display: grid; gap: 0 12px; grid-template-columns: 2fr 1fr; padding: 16px; background: var(--bg); border-radius: var(--radius); }
.add-form .wide { grid-column: 1 / -1; }
.form-actions { display: flex; gap: 8px; grid-column: 1 / -1; }
@media (max-width: 600px) { .add-form { grid-template-columns: 1fr; } }
</style>
