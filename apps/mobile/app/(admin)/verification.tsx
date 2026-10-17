import React, { useState } from 'react'
import { Alert, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Button, Card, CardSkeleton, Chip, EmptyState, ErrorState, StatusPill } from '../../src/components/ui'
import { useApplicationQueue } from '../../src/features/admin/useAdminData'
import { useDecideApplication, useSetProviderStatus } from '../../src/features/admin/useAdminActions'
import { errorMessage } from '../../src/lib/api'
import { fmtMoney } from '../../src/lib/format'
import { spacing, typography, useTheme } from '../../src/theme'

type QueueFilter = 'pending' | 'verified' | 'rejected'

const FILTERS: { key: QueueFilter; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'verified', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
]

export default function AdminVerification() {
  const t = useTheme()
  const [filter, setFilter] = useState<QueueFilter>('pending')
  const q = useApplicationQueue(filter)
  const decide = useDecideApplication()
  const setStatus = useSetProviderStatus()

  const run = async (label: string, fn: () => Promise<unknown>) => {
    try {
      await fn()
    } catch (err) {
      Alert.alert(`${label} failed`, errorMessage(err))
    }
  }

  const confirmDecide = (id: string, action: 'approve' | 'reject' | 'request_more_info', name: string) => {
    const copy =
      action === 'approve'
        ? `Approve ${name}? Their provider profile is verified, but stays hidden until they publish.`
        : action === 'reject'
          ? `Reject ${name}'s application?`
          : `Ask ${name} for more information?`
    Alert.alert('Confirm', copy, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm',
        onPress: () => void run('That action', () => decide.mutateAsync({ applicationId: id, action })),
      },
    ])
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl }}>
        <Text style={{ color: t.text, fontFamily: typography.fontFamily.extraBold, fontSize: typography.size.xxl }}>
          Provider verification
        </Text>
        <Text style={{ color: t.textMuted, fontSize: typography.size.sm, marginTop: 4, marginBottom: spacing.md }}>
          Approving sets the account to provider and provisions their public profile. Nothing is visible to clients
          until the provider publishes.
        </Text>

        <View style={{ flexDirection: 'row', marginBottom: spacing.md }}>
          {FILTERS.map((f) => (
            <Chip key={f.key} label={f.label} selected={filter === f.key} onPress={() => setFilter(f.key)} />
          ))}
        </View>

        {q.isLoading ? (
          <>
            <CardSkeleton />
            <CardSkeleton />
          </>
        ) : q.isError ? (
          <ErrorState message={errorMessage(q.error)} onRetry={() => void q.refetch()} />
        ) : (q.data?.length ?? 0) === 0 ? (
          <EmptyState
            icon="shield-checkmark-outline"
            title={`Nothing ${filter}`}
            body="Applications appear here the moment an applicant submits them."
          />
        ) : (
          q.data?.map((app) => (
            <Card key={app.id} style={{ marginBottom: spacing.md }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: t.text, fontFamily: typography.fontFamily.bold, fontSize: typography.size.lg }}>
                    {app.display_name}
                  </Text>
                  <Text style={{ color: t.textMuted, fontSize: typography.size.sm }}>{app.legal_name}</Text>
                </View>
                <StatusPill status={app.status} />
              </View>

              <Text style={{ color: t.textMuted, fontSize: typography.size.sm, marginTop: spacing.sm }}>
                {[app.city, `Base ${fmtMoney(app.base_price_60_minor)} / 60 min`].filter(Boolean).join(' · ')}
              </Text>

              {app.bio ? (
                <Text numberOfLines={4} style={{ color: t.text, fontSize: typography.size.sm, lineHeight: 20, marginTop: spacing.sm }}>
                  {app.bio}
                </Text>
              ) : null}

              <Text style={{ color: t.textMuted, fontSize: typography.size.xs, marginTop: spacing.sm }}>
                Submitted {new Date(app.created_at).toLocaleDateString()}
              </Text>

              <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, flexWrap: 'wrap' }}>
                {app.status === 'pending' ? (
                  <>
                    <Button title="Approve" icon="checkmark" onPress={() => confirmDecide(app.id, 'approve', app.display_name)} />
                    <Button
                      title="More info"
                      variant="secondary"
                      onPress={() => confirmDecide(app.id, 'request_more_info', app.display_name)}
                    />
                    <Button title="Reject" variant="danger" onPress={() => confirmDecide(app.id, 'reject', app.display_name)} />
                  </>
                ) : app.status === 'verified' ? (
                  <>
                    <Button
                      title="Publish"
                      icon="eye"
                      onPress={() =>
                        void run('Publish', () => setStatus.mutateAsync({ providerId: app.user_id, action: 'publish' }))
                      }
                    />
                    <Button
                      title="Suspend"
                      variant="danger"
                      onPress={() =>
                        void run('Suspend', () => setStatus.mutateAsync({ providerId: app.user_id, action: 'suspend' }))
                      }
                    />
                  </>
                ) : (
                  <Button
                    title="Re-open"
                    variant="secondary"
                    onPress={() => confirmDecide(app.id, 'request_more_info', app.display_name)}
                  />
                )}
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  )
}
