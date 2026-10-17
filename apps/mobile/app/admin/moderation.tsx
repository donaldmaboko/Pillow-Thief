import React, { useState } from 'react'
import { Alert, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Button, Card, CardSkeleton, Chip, EmptyState, ErrorState, StatusPill } from '../../src/components/ui'
import { useOpenDisputes, useOpenReports, useOpenTickets } from '../../src/features/admin/useAdminData'
import { useResolveDispute, useResolveTicket, useUpdateReportStatus } from '../../src/features/admin/useAdminActions'
import { errorMessage } from '../../src/lib/api'
import { spacing, typography, useTheme } from '../../src/theme'

type Tab = 'reports' | 'disputes' | 'tickets'

export default function AdminModeration() {
  const t = useTheme()
  const [tab, setTab] = useState<Tab>('reports')

  const reports = useOpenReports()
  const disputes = useOpenDisputes()
  const tickets = useOpenTickets()

  const updateReport = useUpdateReportStatus()
  const resolveDispute = useResolveDispute()
  const resolveTicket = useResolveTicket()

  const run = async (label: string, fn: () => Promise<unknown>) => {
    try {
      await fn()
    } catch (err) {
      Alert.alert(`${label} failed`, errorMessage(err))
    }
  }

  const counts: Record<Tab, number> = {
    reports: reports.data?.length ?? 0,
    disputes: disputes.data?.length ?? 0,
    tickets: tickets.data?.length ?? 0,
  }

  const active = tab === 'reports' ? reports : tab === 'disputes' ? disputes : tickets

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }}>
        <Text style={{ color: t.text, fontFamily: typography.fontFamily.extraBold, fontSize: typography.size.xxl }}>
          Moderation &amp; safety
        </Text>
        <Text style={{ color: t.textMuted, fontSize: typography.size.sm, marginTop: 4, marginBottom: spacing.md }}>
          Safety comes first. Resolutions are written to the audit log.
        </Text>

        <View style={{ flexDirection: 'row', marginBottom: spacing.md }}>
          {(['reports', 'disputes', 'tickets'] as Tab[]).map((key) => (
            <Chip
              key={key}
              label={`${key.charAt(0).toUpperCase()}${key.slice(1)}${counts[key] ? ` ${counts[key]}` : ''}`}
              selected={tab === key}
              onPress={() => setTab(key)}
            />
          ))}
        </View>

        {active.isLoading ? (
          <>
            <CardSkeleton />
            <CardSkeleton />
          </>
        ) : active.isError ? (
          <ErrorState message={errorMessage(active.error)} onRetry={() => void active.refetch()} />
        ) : counts[tab] === 0 ? (
          <EmptyState icon="checkmark-done-outline" title="All clear" body={`No open ${tab}.`} />
        ) : tab === 'reports' ? (
          reports.data?.map((r) => (
            <Card key={r.id} style={{ marginBottom: spacing.md }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }}>
                <Text style={{ color: t.text, fontFamily: typography.fontFamily.bold, textTransform: 'capitalize', flex: 1 }}>
                  {r.category.replace(/_/g, ' ')}
                </Text>
                <StatusPill status={r.status} />
              </View>
              <Text style={{ color: t.text, fontSize: typography.size.sm, lineHeight: 20, marginTop: spacing.sm }}>
                {r.description}
              </Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
                <Button
                  title="Resolve"
                  onPress={() => void run('Resolve', () => updateReport.mutateAsync({ reportId: r.id, status: 'resolved' }))}
                />
                <Button
                  title="Dismiss"
                  variant="secondary"
                  onPress={() => void run('Dismiss', () => updateReport.mutateAsync({ reportId: r.id, status: 'dismissed' }))}
                />
              </View>
            </Card>
          ))
        ) : tab === 'disputes' ? (
          disputes.data?.map((d) => (
            <Card key={d.id} style={{ marginBottom: spacing.md }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }}>
                <Text style={{ color: t.text, fontFamily: typography.fontFamily.bold }}>Booking dispute</Text>
                <StatusPill status={d.status} />
              </View>
              <Text style={{ color: t.text, fontSize: typography.size.sm, lineHeight: 20, marginTop: spacing.sm }}>
                {d.reason}
              </Text>
              <Text style={{ color: t.textMuted, fontSize: typography.size.xs, marginTop: spacing.xs }}>
                Booking {d.booking_id.slice(0, 8)}
              </Text>
              <Button
                title="Mark resolved"
                style={{ marginTop: spacing.md }}
                onPress={() => void run('Resolve', () => resolveDispute.mutateAsync({ disputeId: d.id }))}
              />
            </Card>
          ))
        ) : (
          tickets.data?.map((k) => (
            <Card key={k.id} style={{ marginBottom: spacing.md }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }}>
                <Text style={{ color: t.text, fontFamily: typography.fontFamily.bold, flex: 1 }}>{k.subject}</Text>
                <StatusPill status={k.status} />
              </View>
              <Text style={{ color: t.textMuted, fontSize: typography.size.xs, marginTop: spacing.xs, textTransform: 'capitalize' }}>
                {k.category}
              </Text>
              <Button
                title="Mark resolved"
                style={{ marginTop: spacing.md }}
                onPress={() => void run('Resolve', () => resolveTicket.mutateAsync({ ticketId: k.id }))}
              />
            </Card>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
