package com.meishi.app.ui.components

import androidx.compose.foundation.gestures.detectDragGesturesAfterLongPress
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.DragHandle
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.zIndex
import androidx.compose.foundation.layout.offset
import com.meishi.app.model.SnsType
import kotlin.math.roundToInt

data class SnsRowData(
    val key: String,
    val type: SnsType,
    val value: String,
    val serviceName: String = "",
    val label: String = type.displayName
)

private const val ROW_HEIGHT_DP = 64

/**
 * SNS一覧のドラッグ&ドロップ並び替えエディタ。
 * 各行: 並び替えハンドル / SNSアイコン / 入力フィールド / 削除ボタン
 */
@Composable
fun SnsEditorList(
    items: List<SnsRowData>,
    onChange: (List<SnsRowData>) -> Unit,
    onValueChange: (key: String, newValue: String) -> Unit,
    onRemove: (key: String) -> Unit,
    modifier: Modifier = Modifier
) {
    val density = androidx.compose.ui.platform.LocalDensity.current
    val rowHeightPx = with(density) { ROW_HEIGHT_DP.dp.toPx() }

    var draggingKey by remember { mutableStateOf<String?>(null) }
    var dragOffsetY by remember { mutableStateOf(0f) }

    LazyColumn(modifier = modifier) {
        items(items, key = { it.key }) { row ->
            val isDragging = draggingKey == row.key
            Surface(
                tonalElevation = if (isDragging) 4.dp else 0.dp,
                modifier = Modifier
                    .fillMaxWidth()
                    .zIndex(if (isDragging) 1f else 0f)
                    .then(
                        if (isDragging) Modifier.offset { IntOffset(0, dragOffsetY.roundToInt()) }
                        else Modifier
                    )
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 8.dp, vertical = 4.dp)
                ) {
                    Icon(
                        imageVector = Icons.Filled.DragHandle,
                        contentDescription = "並び替え",
                        modifier = Modifier
                            .padding(end = 8.dp)
                            .pointerInput(row.key) {
                                detectDragGesturesAfterLongPress(
                                    onDragStart = {
                                        draggingKey = row.key
                                        dragOffsetY = 0f
                                    },
                                    onDrag = { change, dragAmount ->
                                        change.consume()
                                        dragOffsetY += dragAmount.y
                                        val currentIndex = items.indexOfFirst { it.key == row.key }
                                        if (currentIndex < 0) return@detectDragGesturesAfterLongPress
                                        if (dragOffsetY > rowHeightPx / 2 && currentIndex < items.size - 1) {
                                            val newList = items.toMutableList()
                                            val moved = newList.removeAt(currentIndex)
                                            newList.add(currentIndex + 1, moved)
                                            onChange(newList)
                                            dragOffsetY -= rowHeightPx
                                        } else if (dragOffsetY < -rowHeightPx / 2 && currentIndex > 0) {
                                            val newList = items.toMutableList()
                                            val moved = newList.removeAt(currentIndex)
                                            newList.add(currentIndex - 1, moved)
                                            onChange(newList)
                                            dragOffsetY += rowHeightPx
                                        }
                                    },
                                    onDragEnd = {
                                        draggingKey = null
                                        dragOffsetY = 0f
                                    },
                                    onDragCancel = {
                                        draggingKey = null
                                        dragOffsetY = 0f
                                    }
                                )
                            }
                    )
                    Icon(
                        imageVector = row.type.icon(),
                        contentDescription = row.label,
                        modifier = Modifier
                            .size(22.dp)
                            .padding(end = 8.dp),
                        tint = MaterialTheme.colorScheme.primary
                    )
                    OutlinedTextField(
                        value = row.value,
                        onValueChange = { onValueChange(row.key, it) },
                        modifier = Modifier.weight(1f),
                        singleLine = true,
                        label = { Text(row.label) }
                    )
                    IconButton(onClick = { onRemove(row.key) }) {
                        Icon(Icons.Filled.Close, contentDescription = "削除")
                    }
                }
            }
        }
    }
}
