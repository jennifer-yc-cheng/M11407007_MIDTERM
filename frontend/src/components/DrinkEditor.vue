<script setup>
// 飲品管理表格：總部用來管理共用菜單、店長用來管理本店特色飲品（含照片上傳）
import { onBeforeUnmount, reactive, ref } from 'vue';
import { money } from '../api.js';
import DrinkImage from './DrinkImage.vue';

const props = defineProps({
  items: { type: Array, required: true },
  allowDelete: { type: Boolean, default: false },
  uploadable: { type: Boolean, default: false },
  addLabel: { type: String, default: '新增飲品' },
});
const emit = defineEmits(['create', 'update', 'remove', 'upload', 'remove-image']);

const editingId = ref(null);
const draft = reactive({ name: '', price: '', description: '', isActive: true });
const adding = ref(false);
const blank = reactive({ name: '', price: '', description: '', isActive: true, file: null });
const preview = ref(null);

function startEdit(d) {
  editingId.value = d.id;
  Object.assign(draft, { name: d.name, price: d.price, description: d.description, isActive: d.isActive });
}
function saveEdit() {
  emit('update', { id: editingId.value, ...draft });
  editingId.value = null;
}

function setPreview(file) {
  if (preview.value) URL.revokeObjectURL(preview.value);
  preview.value = file ? URL.createObjectURL(file) : null;
}
function pickNewPhoto(e) {
  blank.file = e.target.files[0] || null;
  setPreview(blank.file);
}
function resetNew() {
  Object.assign(blank, { name: '', price: '', description: '', isActive: true, file: null });
  setPreview(null);
  adding.value = false;
}
function saveNew() {
  emit('create', { ...blank });
  resetNew();
}

function pickPhoto(d, e) {
  const file = e.target.files[0];
  e.target.value = ''; // 讓同一個檔案可以再選一次
  if (file) emit('upload', { id: d.id, name: d.name, file });
}
function toggle(d) {
  emit('update', { ...d, isActive: !d.isActive });
}
function remove(d) {
  if (window.confirm(`確定要刪除「${d.name}」嗎？`)) emit('remove', d.id);
}
function removeImage(d) {
  if (window.confirm(`確定要移除「${d.name}」的照片嗎？`)) emit('remove-image', d.id);
}

onBeforeUnmount(() => setPreview(null));
</script>

<template>
  <div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>照片</th><th>名稱</th><th>說明</th><th class="num">價格</th><th>狀態</th><th></th></tr>
        </thead>
        <tbody>
          <tr v-for="d in props.items" :key="d.id">
            <td class="photo-cell">
              <div class="thumb"><DrinkImage :src="d.image" :name="d.name" /></div>
              <div v-if="uploadable" class="photo-actions">
                <label class="link">
                  {{ d.image ? '更換' : '上傳照片' }}
                  <input type="file" accept="image/*" hidden @change="pickPhoto(d, $event)" />
                </label>
                <button v-if="d.image" class="link danger-link" @click="removeImage(d)">移除</button>
              </div>
            </td>
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
            <td colspan="6" class="muted">目前沒有飲品</td>
          </tr>
        </tbody>
      </table>
    </div>

    <form v-if="adding" class="add-form" @submit.prevent="saveNew">
      <div v-if="uploadable" class="new-photo">
        <div class="thumb big">
          <img v-if="preview" :src="preview" alt="預覽" />
          <DrinkImage v-else :src="null" :name="blank.name || '新'" />
        </div>
        <label class="btn ghost small">
          {{ blank.file ? '更換照片' : '選擇照片' }}
          <input type="file" accept="image/*" hidden @change="pickNewPhoto" />
        </label>
      </div>
      <div class="fields">
        <label class="field"><span>名稱</span><input v-model="blank.name" required maxlength="100" /></label>
        <label class="field"><span>價格</span><input v-model.number="blank.price" type="number" min="0" required /></label>
        <label class="field wide"><span>說明</span><input v-model="blank.description" maxlength="500" /></label>
        <div class="form-actions">
          <button class="btn" type="submit">新增</button>
          <button class="btn ghost" type="button" @click="resetNew">取消</button>
        </div>
      </div>
    </form>
    <button v-else class="btn ghost add-btn" @click="adding = true">＋ {{ addLabel }}</button>
  </div>
</template>

<style scoped>
.actions { white-space: nowrap; display: flex; gap: 6px; }
.photo-cell { width: 92px; }
.thumb { width: 56px; }
.thumb.big { width: 120px; }
.thumb.big img { width: 100%; aspect-ratio: 1 / 1; object-fit: cover; border-radius: 10px; display: block; }
.photo-actions { display: flex; gap: 8px; margin-top: 4px; font-size: 0.8rem; white-space: nowrap; }
.link { color: var(--brand); cursor: pointer; background: none; border: 0; padding: 0; font: inherit; }
.link:hover { text-decoration: underline; }
.danger-link { color: var(--danger); }
.add-btn { margin-top: 12px; }
.add-form { margin-top: 16px; display: flex; gap: 20px; align-items: flex-start; padding: 16px; background: var(--bg); border-radius: var(--radius); flex-wrap: wrap; }
.new-photo { display: flex; flex-direction: column; align-items: center; gap: 8px; }
.fields { flex: 1; min-width: 240px; display: grid; gap: 0 12px; grid-template-columns: 2fr 1fr; }
.fields .wide { grid-column: 1 / -1; }
.form-actions { display: flex; gap: 8px; grid-column: 1 / -1; }
@media (max-width: 600px) { .fields { grid-template-columns: 1fr; } }
</style>
