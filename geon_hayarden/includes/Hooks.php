<?php

namespace MediaWiki\Extension\GeonHayarden;

use MediaWiki\Hook\BeforePageDisplayHook;
use MediaWiki\Preferences\Hook\GetPreferencesHook;
use MediaWiki\User\UserOptionsLookup;
use MediaWiki\User\Hook\UserGetDefaultOptionsHook;

class Hooks implements BeforePageDisplayHook, GetPreferencesHook, UserGetDefaultOptionsHook {
    private UserOptionsLookup $userOptionsLookup;

    public function __construct(UserOptionsLookup $userOptionsLookup) {
        $this->userOptionsLookup = $userOptionsLookup;
    }

    public function onUserGetDefaultOptions( &$defaultOptions ) {
    
        $defaultOptions['compare_to_wikipedia'] = false;
        $defaultOptions['use_netfree_filtering'] = false;
    }

    /**
     * Add the necessary JavaScript configuration variable
     * @inheritDoc
     */
    public function onBeforePageDisplay( $out, $skin ): void {
        $user = $out->getUser();
        $compareToWikipedia = $this->userOptionsLookup->getOption($user, 'compare_to_wikipedia');
        $useNetfreeFiltering = $this->userOptionsLookup->getOption($user, 'use_netfree_filtering');

        $out->addJsConfigVars( 'wgCompareToWikipedia', $compareToWikipedia );
        $out->addJsConfigVars( 'wgUseNetfreeFiltering', $useNetfreeFiltering );

        if ($compareToWikipedia) {
            $out->addModules( 'ext.geonHayarden' );
           }
    }
    
    
    public function onGetPreferences( $user, &$preferences ): void {

        $preferences['compare_to_wikipedia'] = [
            'type' => 'toggle',
            'label-message' => 'geonhayarden-compare-to-wikipedia-label',
            'section' => 'private_scripts/compare-to-wikipedia',
        ];
        $preferences['use_netfree_filtering'] = [
            'type' => 'toggle',
            'label-message' => 'geonhayarden-use-netfree-label',
            'section' => 'private_scripts/internet-connection',
        ];
           
    }
    
}
