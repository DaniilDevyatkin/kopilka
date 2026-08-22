"use client";

import { useState } from "react";

import {
  AppDialog,
  Badge,
  BottomSheet,
  Button,
  Card,
  Checkbox,
  DateInput,
  DestructiveConfirmation,
  EmptyState,
  ErrorState,
  FormField,
  IconButton,
  Input,
  MoneyInput,
  PasswordInput,
  Popover,
  Progress,
  Select,
  Skeleton,
  StatusMessage,
  Switch,
  Textarea,
  Toast,
  ToastViewport,
} from "@/components/ui";
import styles from "./ui-playground.module.css";

export function UiPlayground() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);

  return (
    <div className={styles.sections}>
      <section aria-labelledby="actions-title">
        <header className={styles.sectionHeading}>
          <span>01</span>
          <div>
            <h2 id="actions-title">Действия</h2>
            <p>Ясная иерархия, честные pending и disabled состояния.</p>
          </div>
        </header>
        <Card className={styles.actionRow} elevation="raised">
          <Button>Продолжить</Button>
          <Button variant="secondary">Отложить</Button>
          <Button variant="ghost">Подробнее</Button>
          <Button variant="danger">Удалить</Button>
          <Button pending>Сохраняем</Button>
          <Button disabled>Недоступно</Button>
          <IconButton icon="edit" label="Изменить" />
          <IconButton icon="close" label="Закрыть" variant="secondary" />
        </Card>
      </section>

      <section aria-labelledby="forms-title">
        <header className={styles.sectionHeading}>
          <span>02</span>
          <div>
            <h2 id="forms-title">Формы без догадок</h2>
            <p>
              Видимые labels, подсказки, inline errors и мобильные клавиатуры.
            </p>
          </div>
        </header>
        <Card className={styles.formGrid} elevation="raised">
          <FormField label="Название счёта" required>
            <Input name="account-name" placeholder="Например, На каждый день" />
          </FormField>
          <FormField label="Пароль" hint="Не короче 10 символов" required>
            <PasswordInput name="password" autoComplete="new-password" />
          </FormField>
          <FormField label="Сумма" hint="Запятая и точка поддерживаются">
            <MoneyInput name="amount" currency="RUB" placeholder="0 ₽" />
          </FormField>
          <FormField label="Дата покупки">
            <DateInput name="target-date" />
          </FormField>
          <FormField label="Тип счёта">
            <Select name="account-type" defaultValue="debit">
              <option value="debit">Дебетовая карта</option>
              <option value="cash">Наличные</option>
              <option value="savings">Накопительный счёт</option>
            </Select>
          </FormField>
          <FormField label="Комментарий" error="Не больше 200 символов">
            <Textarea
              name="comment"
              defaultValue="Очень длинный комментарий проверяет перенос русского текста без горизонтального скролла."
            />
          </FormField>
          <div className={styles.choiceGroup}>
            <Checkbox
              label="Учитывать в капитале"
              description="Счёт попадёт в общую сумму"
              defaultChecked
            />
            <Switch
              label="Напоминать о плане"
              description="Настройку можно изменить позже"
            />
          </div>
        </Card>
      </section>

      <section aria-labelledby="states-title">
        <header className={styles.sectionHeading}>
          <span>03</span>
          <div>
            <h2 id="states-title">Состояние видно и слышно</h2>
            <p>
              Цвет всегда поддержан текстом, формой или собственной иконкой.
            </p>
          </div>
        </header>
        <div className={styles.stateGrid}>
          <Card className={styles.stack}>
            <div className={styles.badges}>
              <Badge>Черновик</Badge>
              <Badge tone="accent">В работе</Badge>
              <Badge tone="positive">По плану</Badge>
              <Badge tone="warning">Нужно внимание</Badge>
              <Badge tone="negative">Просрочено</Badge>
            </div>
            <Progress
              value={62}
              label="Накоплено"
              valueText="62 000 из 100 000 ₽ · 62%"
            />
            <StatusMessage tone="positive">Изменения сохранены</StatusMessage>
            <StatusMessage tone="warning">
              До даты цели осталось 12 дней
            </StatusMessage>
          </Card>
          <Card className={styles.stack}>
            <Skeleton lines={3} />
            <Skeleton variant="card" />
          </Card>
          <EmptyState
            title="Пока здесь тихо"
            description="Добавьте доход или расход — история появится здесь."
            action={<Button variant="secondary">Добавить операцию</Button>}
          />
          <ErrorState
            title="Не удалось обновить данные"
            description="Проверьте соединение и попробуйте ещё раз. Введённые данные не потеряны."
            action={<Button variant="secondary">Повторить</Button>}
          />
        </div>
      </section>

      <section aria-labelledby="layers-title">
        <header className={styles.sectionHeading}>
          <span>04</span>
          <div>
            <h2 id="layers-title">Контекстные слои</h2>
            <p>Escape, возврат фокуса, scroll lock и безопасная зона.</p>
          </div>
        </header>
        <Card className={styles.actionRow} elevation="raised">
          <Button onClick={() => setDialogOpen(true)}>Открыть диалог</Button>
          <Button variant="secondary" onClick={() => setSheetOpen(true)}>
            Открыть bottom sheet
          </Button>
          <Button variant="danger" onClick={() => setConfirmOpen(true)}>
            Архивировать
          </Button>
          <Button variant="ghost" onClick={() => setToastVisible(true)}>
            Показать toast
          </Button>
          <Popover trigger="Фильтры" title="Фильтры операций">
            <Checkbox label="Только расходы" />
            <Checkbox label="Текущий месяц" />
            <Button variant="secondary">Применить</Button>
          </Popover>
        </Card>
      </section>

      <AppDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title="Новая хотелка"
        description="Укажите понятное название и сумму — план можно уточнить позже."
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialogOpen(false)}>
              Отмена
            </Button>
            <Button onClick={() => setDialogOpen(false)}>Создать</Button>
          </>
        }
      >
        <div className={styles.dialogForm}>
          <FormField label="Название" required>
            <Input data-autofocus placeholder="Например, Поездка в Грузию" />
          </FormField>
          <FormField label="Стоимость" required>
            <MoneyInput currency="RUB" placeholder="0 ₽" />
          </FormField>
        </div>
      </AppDialog>

      <BottomSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title="Добавить операцию"
        description="Выберите действие — данные появятся на следующем шаге."
      >
        <div className={styles.sheetActions}>
          <Button variant="secondary" onClick={() => setSheetOpen(false)}>
            Доход
          </Button>
          <Button variant="secondary" onClick={() => setSheetOpen(false)}>
            Расход
          </Button>
          <Button variant="secondary" onClick={() => setSheetOpen(false)}>
            Перевод
          </Button>
        </div>
      </BottomSheet>

      <DestructiveConfirmation
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Архивировать счёт?"
        description="Счёт исчезнет из основного списка, но история операций сохранится."
        confirmLabel="Архивировать"
        onConfirm={() => {
          setConfirmOpen(false);
          setToastVisible(true);
        }}
      />

      <ToastViewport>
        {toastVisible ? (
          <Toast tone="positive" onDismiss={() => setToastVisible(false)}>
            Счёт перемещён в архив
          </Toast>
        ) : null}
      </ToastViewport>
    </div>
  );
}
