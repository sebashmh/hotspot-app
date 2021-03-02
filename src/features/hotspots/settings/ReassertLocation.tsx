/* eslint-disable react/jsx-props-no-spreading */
import Balance, { CurrencyType } from '@helium/currency'
import { LocationGeocodedAddress } from 'expo-location'
import React, { memo, useCallback, useEffect, useState } from 'react'
import { useAsync } from 'react-async-hook'
import { useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { useConnectedHotspotContext } from '../../../providers/ConnectedHotspotProvider'
import { RootState } from '../../../store/rootReducer'
import { useAppDispatch } from '../../../store/store'
import { getLocation } from '../../../store/user/appSlice'
import animateTransition from '../../../utils/animateTransition'
import { reverseGeocode } from '../../../utils/location'
import useAlert from '../../../utils/useAlert'
import ReassertLocationFee from './ReassertLocationFee'
import ReassertLocationUpdate from './ReassertLocationUpdate'
import * as Logger from '../../../utils/logger'
import { useHotspotSettingsContext } from './HotspotSettingsProvider'
import { decimalSeparator, groupSeparator } from '../../../utils/i18n'
import ReassertAddressSearch from './ReassertAddressSearch'
import { PlaceGeography } from '../../../utils/googlePlaces'
import { HotspotErrorCode } from '../../../utils/useHotspot'

type Coords = { latitude: number; longitude: number }
const DEFAULT_FEE_DATA = {
  remainingFreeAsserts: 0,
  totalStakingAmountDC: new Balance(0, CurrencyType.dataCredit),
  totalStakingAmountUsd: new Balance(0, CurrencyType.usd),
  totalStakingAmount: new Balance(0, CurrencyType.networkToken),
  hasSufficientBalance: false,
  isFree: false,
}
type Props = { onFinished: () => void }
const ReassertLocation = ({ onFinished }: Props) => {
  const [state, setState] = useState<
    'fee' | 'update' | 'confirm' | 'success' | 'search'
  >('fee')
  const [locationAddress, setLocationAddress] = useState<
    LocationGeocodedAddress | undefined
  >()
  const [updatedLocation, setUpdatedLocation] = useState<Coords | undefined>()
  const dispatch = useAppDispatch()
  const {
    app: { currentLocation },
  } = useSelector((s: RootState) => s)

  const { loadLocationFeeData } = useConnectedHotspotContext()

  const { result: feeData = DEFAULT_FEE_DATA } = useAsync(
    loadLocationFeeData,
    [],
  )
  const { t } = useTranslation()
  const { enableBack } = useHotspotSettingsContext()

  const { showOKAlert } = useAlert()

  const handleBack = useCallback(() => {
    animateTransition()
    switch (state) {
      case 'fee':
      case 'success':
        onFinished()
        break
      case 'update':
        setState('fee')
        break
      case 'confirm':
        setState('update')
        break
    }
  }, [onFinished, state])

  useEffect(() => {
    enableBack(handleBack)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    dispatch(getLocation())
  }, [dispatch])

  useEffect(() => {
    if (!currentLocation) return

    const getLoc = async () => {
      const locInfo = await reverseGeocode(
        currentLocation.latitude,
        currentLocation.longitude,
      )
      if (!locInfo.length) return

      setLocationAddress(locInfo[0])
    }
    getLoc()
  }, [currentLocation])

  useEffect(() => {
    if (!updatedLocation) return

    const getLoc = async () => {
      const locInfo = await reverseGeocode(
        updatedLocation.latitude,
        updatedLocation.longitude,
      )
      if (!locInfo.length) return

      setLocationAddress(locInfo[0])
    }
    getLoc()
  }, [updatedLocation])

  const handleFailure = async (error: Error | string) => {
    let titleKey = 'generic.error'
    let messageKey = t('hotspot_setup.add_hotspot.assert_loc_error_body')
    if (error instanceof Error) {
      messageKey = error.message

      if (messageKey === HotspotErrorCode.WAIT) {
        messageKey = t('hotspot_setup.add_hotspot.wait_error_body')
        titleKey = t('hotspot_setup.add_hotspot.wait_error_title')
      } else if (messageKey === HotspotErrorCode.GATEWAY_NOT_FOUND) {
        messageKey = t('hotspot_setup.add_hotspot.gateway_not_found_error_body')
        titleKey = t('hotspot_setup.add_hotspot.gateway_not_found_error_title')
      }
    }

    Logger.error(error)
    await showOKAlert({
      titleKey,
      messageKey,
    })

    onFinished()
  }

  const handleSearch = useCallback(() => {
    animateTransition()
    setState('search')
  }, [])

  const handleSearchSelectPlace = useCallback((place: PlaceGeography) => {
    const { lat, lng } = place
    setUpdatedLocation({ latitude: lat, longitude: lng })
    animateTransition()
    setState('confirm')
  }, [])

  const amount = feeData.isFree
    ? 'O DC'
    : feeData.totalStakingAmountDC.toString(0, {
        groupSeparator,
        decimalSeparator,
      })

  switch (state) {
    case 'fee':
      return (
        <ReassertLocationFee
          {...feeData}
          locationAddress={locationAddress}
          onChangeLocation={() => {
            animateTransition()
            setState('update')
          }}
        />
      )
    case 'update':
      return (
        <ReassertLocationUpdate
          amount={amount}
          key={state}
          onCancel={handleBack}
          onSearch={handleSearch}
          locationSelected={(latitude, longitude) => {
            setUpdatedLocation({ latitude, longitude })
            animateTransition()
            setState('confirm')
          }}
        />
      )
    case 'search':
      return <ReassertAddressSearch onSelectPlace={handleSearchSelectPlace} />
    case 'confirm':
      return (
        <ReassertLocationUpdate
          amount={amount}
          key={state}
          onCancel={handleBack}
          confirming
          coords={updatedLocation}
          onFailure={handleFailure}
          onSearch={handleSearch}
          onSuccess={() => {
            setState('success')
          }}
        />
      )
    case 'success':
      return (
        <ReassertLocationFee
          {...feeData}
          locationAddress={locationAddress}
          isPending
        />
      )
  }
}

export default memo(ReassertLocation)
